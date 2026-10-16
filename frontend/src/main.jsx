import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Film, Search, Sparkles, Star, TrendingUp, Clapperboard, RefreshCw } from "lucide-react";
import "./style.css";

const API = "http://127.0.0.1:8000";
const genres = ["All", "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Thriller"];

function App() {
  const [movies, setMovies] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [userId, setUserId] = useState("1");
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function request(path) {
    const response = await fetch(`${API}${path}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Could not connect to the API.");
    }
    return response.json();
  }

  async function loadMovies() {
    try {
      const params = new URLSearchParams({ search, genre, limit: "100" });
      setMovies(await request(`/movies?${params}`));
      setError("");
    } catch (e) { setError(`${e.message} Make sure the Python backend is running.`); }
  }

  async function loadRecommendations() {
    try {
      setLoading(true);
      setRecommendations(await request(`/recommend?user_id=${userId}&limit=12`));
      setMetrics(await request("/metrics"));
      setError("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    request("/users").then(data => {
      setUsers(data);
      if (data.length) setUserId(String(data[0].userId));
    }).catch(() => setError("Start the backend and load the MovieLens dataset first."));
    request("/metrics").then(setMetrics).catch(() => {});
  }, []);

  useEffect(() => { loadMovies(); }, [search, genre]);
  useEffect(() => { if (userId) loadRecommendations(); }, [userId]);

  async function predict(movie) {
    try {
      setSelectedMovie(movie);
      setPrediction(null);
      const data = await request(`/predict?user_id=${userId}&movie_id=${movie.movieId}`);
      setPrediction(data);
    } catch (e) { setError(e.message); }
  }

  const featured = useMemo(() => recommendations.slice(0, 4), [recommendations]);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><Film size={21}/></span><span>Cine<span className="accent">Sense</span></span></a>
      <nav><a className="active" href="#discover">Discover</a><a href="#for-you">For you</a><a href="#insights">Model insights</a></nav>
      <div className="user-picker"><span>PROFILE</span><select value={userId} onChange={e => setUserId(e.target.value)}>{users.map(u => <option key={u.userId} value={u.userId}>User {u.userId}</option>)}</select></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14}/> YOUR PERSONAL MOVIE INTELLIGENCE</div>
          <h1>Find your next<br/><span>favorite film.</span></h1>
          <p>A hybrid recommendation engine that learns from movie ratings and genre preferences to predict what you'll love next.</p>
          <a className="primary-button" href="#for-you">Explore recommendations <TrendingUp size={17}/></a>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
          <div className="poster poster-back">✦</div><div className="poster poster-mid">CINEMA<br/>AFTER<br/>DARK</div>
          <div className="poster poster-front"><Clapperboard size={32}/><span>YOUR NEXT<br/>5-STAR FILM</span><div className="poster-stars">★★★★★</div></div>
          <div className="floating-rating"><Star size={15} fill="currentColor"/> AI PICK <b>4.8</b></div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section id="for-you" className="section">
        <div className="section-heading"><div><div className="eyebrow">CURATED FOR PROFILE {userId}</div><h2>Picked for you <span className="accent">✦</span></h2></div><button className="ghost-button" onClick={loadRecommendations}><RefreshCw size={15}/> Refresh</button></div>
        <p className="section-subtitle">Movies you haven't rated yet, ranked by predicted preference.</p>
        <div className="movie-grid featured-grid">
          {featured.map((m, i) => <MovieCard key={m.movieId} movie={m} index={i} onPredict={predict} predicted/>)}
          {!featured.length && <p className="muted">Recommendations will appear when the API is ready.</p>}
        </div>
      </section>

      <section id="discover" className="section">
        <div className="section-heading"><div><div className="eyebrow">THE MOVIE LIBRARY</div><h2>Discover films</h2></div><span className="result-count">{movies.length} titles shown</span></div>
        <div className="search-row"><div className="searchbox"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search movies by title..."/></div><div className="genre-scroll">{genres.map(g => <button key={g} onClick={() => setGenre(g)} className={`genre-chip ${genre === g ? "selected" : ""}`}>{g}</button>)}</div></div>
        <div className="movie-grid">{movies.slice(0, 24).map((m, i) => <MovieCard key={m.movieId} movie={m} index={i} onPredict={predict}/>)}</div>
      </section>

      <section id="insights" className="section insights">
        <div><div className="eyebrow">UNDER THE HOOD</div><h2>Model insights</h2><p className="section-subtitle">Evaluation on a held-out portion of the MovieLens ratings.</p></div>
        <div className="metric-grid">
          <div className="metric-card"><span>MAE</span><strong>{metrics?.mae ?? "—"}</strong><small>Mean absolute error</small></div>
          <div className="metric-card"><span>RMSE</span><strong>{metrics?.rmse ?? "—"}</strong><small>Root mean squared error</small></div>
          <div className="metric-card"><span>HYBRID</span><strong>70 / 30</strong><small>Collaborative / content weighting</small></div>
        </div>
        <p className="fine-print">Note: The displayed MAE/RMSE evaluate a movie-average baseline on a held-out split, while live predictions use the hybrid model. For a formal report, evaluate the exact hybrid predictor on held-out ratings before claiming its error score.</p>
      </section>
    </main>

    <footer><a className="brand" href="#"><span className="brand-icon"><Film size={18}/></span>Cine<span className="accent">Sense</span></a><span>Machine Learning Mini Project · MovieLens dataset</span></footer>

    {selectedMovie && <div className="modal-backdrop" onClick={() => {setSelectedMovie(null);setPrediction(null);}}>
      <div className="modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => {setSelectedMovie(null);setPrediction(null);}}>×</button><div className="eyebrow">AI RATING PREDICTION</div><h2>{selectedMovie.title}</h2><p className="muted">{selectedMovie.genres}</p>
        {prediction ? <div className="prediction-result"><div className="big-rating">{prediction.predictedRating.toFixed(2)}<small>/ 5</small></div><div className="stars">{"★".repeat(Math.round(prediction.predictedRating))}{"☆".repeat(5-Math.round(prediction.predictedRating))}</div><p>Predicted for User {userId}</p></div> : <div className="loading"><RefreshCw className="spin"/> Calculating predicted rating…</div>}
        <button className="primary-button full" onClick={() => {setSelectedMovie(null);setPrediction(null);}}>Done</button>
      </div>
    </div>}
  </div>;
}

function MovieCard({ movie, index, onPredict, predicted = false }) {
  const palette = ["poster-a", "poster-b", "poster-c", "poster-d", "poster-e", "poster-f"];
  const year = movie.title.match(/\((\d{4})\)/)?.[1] || "Film";
  const rating = predicted ? movie.predictedRating : movie.averageRating;
  return <article className="movie-card">
    <button className={`movie-art ${palette[index % palette.length]}`} onClick={() => onPredict(movie)} aria-label={`Predict rating for ${movie.title}`}>
      <span className="art-label">{movie.genres?.split("|").slice(0, 2).join(" · ")}</span><span className="art-title">{movie.title.replace(/\s*\(\d{4}\)\s*$/, "")}</span><span className="art-year">{year}</span><span className="art-film"><Film size={30}/></span>
    </button>
    <div className="movie-info"><div className="movie-title-row"><h3 title={movie.title}>{movie.title}</h3><span className="rating"><Star size={13} fill="currentColor"/>{Number(rating || 0).toFixed(1)}</span></div><p>{predicted ? "Predicted rating" : (movie.genres || "Genre not listed").replaceAll("|", " · ")}</p><button className="predict-link" onClick={() => onPredict(movie)}><Sparkles size={13}/> Predict my rating</button></div>
  </article>;
}

createRoot(document.getElementById("root")).render(<App/>);
