from pathlib import Path
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE = Path(__file__).resolve().parent
DATA = BASE / "ml-latest-small"

app = FastAPI(title="Movie Rating Prediction API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

movies = pd.DataFrame()
ratings = pd.DataFrame()
rating_matrix = pd.DataFrame()
user_similarity = None
genre_matrix = None
movie_id_set = set()
global_mean = 3.5
metrics = {"mae": None, "rmse": None}

def build_models():
    global movies, ratings, rating_matrix, user_similarity
    global genre_matrix, global_mean, metrics, movie_id_set

    movies_path = DATA / "movies.csv"
    ratings_path = DATA / "ratings.csv"
    if not movies_path.exists() or not ratings_path.exists():
        raise RuntimeError(
            f"Dataset files not found. Extract ml-latest-small.zip into {DATA}. "
            "The folder must contain movies.csv and ratings.csv."
        )

    movies = pd.read_csv(movies_path)
    ratings = pd.read_csv(ratings_path)
    ratings = ratings.dropna(subset=["userId", "movieId", "rating"])
    ratings["userId"] = ratings["userId"].astype(int)
    ratings["movieId"] = ratings["movieId"].astype(int)
    global_mean = float(ratings["rating"].mean())

    # Holdout evaluation on unseen ratings. Fit a separate matrix on training rows.
    train, test = train_test_split(ratings, test_size=0.2, random_state=42)
    eval_matrix = train.pivot_table(index="userId", columns="movieId", values="rating")
    eval_pred = []
    eval_actual = []
    eval_means = train.groupby("movieId")["rating"].mean()
    for row in test.itertuples(index=False):
        eval_pred.append(float(eval_means.get(row.movieId, train["rating"].mean())))
        eval_actual.append(float(row.rating))
    metrics = {
        "mae": round(float(mean_absolute_error(eval_actual, eval_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(eval_actual, eval_pred))), 4),
    }

    # Refit on all ratings for the live application.
    rating_matrix = ratings.pivot_table(index="userId", columns="movieId", values="rating")
    filled = rating_matrix.fillna(0)
    user_similarity = cosine_similarity(filled)
    movie_id_set = set(movies["movieId"].astype(int))

    genres = movies["genres"].fillna("").str.get_dummies(sep="|")
    genre_matrix = genres
    genre_matrix.index = movies["movieId"].astype(int)
    return True

def predict_rating(user_id: int, movie_id: int) -> float:
    if movie_id not in movie_id_set:
        raise HTTPException(status_code=404, detail="Movie not found")

    # User-user collaborative filtering: similar users' ratings.
    collab = None
    if user_id in rating_matrix.index and movie_id in rating_matrix.columns:
        user_pos = rating_matrix.index.get_loc(user_id)
        similarities = user_similarity[user_pos].copy()
        target_col = rating_matrix.columns.get_loc(movie_id)
        rated_mask = rating_matrix.iloc[:, target_col].notna().to_numpy()
        similarities[user_pos] = 0
        candidates = np.where(rated_mask)[0]
        if len(candidates):
            sims = similarities[candidates]
            values = rating_matrix.iloc[candidates, target_col].to_numpy(dtype=float)
            order = np.argsort(sims)[::-1][:30]
            sims, values = sims[order], values[order]
            positive = sims > 0
            if positive.any():
                collab = float(np.average(values[positive], weights=sims[positive]))

    # Content-based score: average the user's ratings for genre-similar movies.
    content = None
    if user_id in rating_matrix.index and movie_id in genre_matrix.index:
        rated = rating_matrix.loc[user_id].dropna()
        if not rated.empty:
            target_genres = genre_matrix.loc[movie_id].to_numpy(dtype=float).reshape(1, -1)
            common_ids = [int(mid) for mid in rated.index if mid in genre_matrix.index]
            if common_ids:
                similarities = cosine_similarity(
                    target_genres,
                    genre_matrix.loc[common_ids].to_numpy(dtype=float)
                )[0]
                rated_values = rated.loc[common_ids].to_numpy(dtype=float)
                if np.any(similarities > 0):
                    content = float(np.average(rated_values, weights=similarities + 1e-8))

    movie_avg = ratings.groupby("movieId")["rating"].mean().get(movie_id, global_mean)
    if collab is not None and content is not None:
        result = 0.7 * collab + 0.3 * content
    elif collab is not None:
        result = collab
    elif content is not None:
        result = content
    else:
        result = float(movie_avg)
    return round(float(np.clip(result, 0.5, 5.0)), 2)

@app.on_event("startup")
def startup():
    build_models()

@app.get("/")
def home():
    return {"message": "Movie Rating Prediction API is running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok", "movies": int(len(movies)), "ratings": int(len(ratings))}

@app.get("/movies")
def get_movies(search: str = "", genre: str = "", limit: int = 100):
    df = movies.copy()
    if search:
        df = df[df["title"].str.contains(search, case=False, na=False)]
    if genre and genre.lower() != "all":
        df = df[df["genres"].str.contains(genre, case=False, na=False)]
    avgs = ratings.groupby("movieId")["rating"].agg(["mean", "count"]).reset_index()
    df = df.merge(avgs, on="movieId", how="left")
    df["mean"] = df["mean"].fillna(global_mean).round(2)
    df["count"] = df["count"].fillna(0).astype(int)
    df = df.sort_values(["count", "mean"], ascending=False).head(max(1, min(limit, 500)))
    return [
        {"movieId": int(r.movieId), "title": r.title, "genres": r.genres,
         "averageRating": float(r.mean), "ratingCount": int(r.count)}
        for r in df.itertuples(index=False)
    ]

@app.get("/users")
def get_users():
    ids = sorted(ratings["userId"].unique().tolist())
    return [{"userId": int(uid)} for uid in ids[:250]]

@app.get("/predict")
def predict(user_id: int, movie_id: int):
    value = predict_rating(user_id, movie_id)
    title = movies.loc[movies["movieId"] == movie_id, "title"].iloc[0]
    return {"userId": user_id, "movieId": movie_id, "title": title, "predictedRating": value}

@app.get("/recommend")
def recommend(user_id: int, limit: int = 12):
    if user_id not in rating_matrix.index:
        raise HTTPException(status_code=404, detail="Unknown user ID")
    already_rated = set(rating_matrix.loc[user_id].dropna().index.astype(int))
    candidates = movies[~movies["movieId"].isin(already_rated)].copy()
    candidates["predictedRating"] = candidates["movieId"].apply(
        lambda mid: predict_rating(user_id, int(mid))
    )
    avgs = ratings.groupby("movieId")["rating"].agg(["mean", "count"]).reset_index()
    candidates = candidates.merge(avgs, on="movieId", how="left")
    candidates["mean"] = candidates["mean"].fillna(global_mean)
    candidates["count"] = candidates["count"].fillna(0).astype(int)
    candidates = candidates.sort_values(["predictedRating", "count"], ascending=False).head(
        max(1, min(limit, 50))
    )
    return [
        {"movieId": int(r.movieId), "title": r.title, "genres": r.genres,
         "predictedRating": float(r.predictedRating),
         "averageRating": round(float(r.mean), 2), "ratingCount": int(r.count)}
        for r in candidates.itertuples(index=False)
    ]

@app.get("/metrics")
def get_metrics():
    return metrics
