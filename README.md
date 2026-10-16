# CineSense — Movie Rating Prediction System

A college mini project using React + Vite, FastAPI, Pandas, NumPy and scikit-learn.

## Features
- Search movies and filter by genre.
- Select a MovieLens user profile.
- Predict a user's likely rating for a selected movie.
- Recommend unrated movies.
- Show MAE/RMSE evaluation values.
- Hybrid scoring combines collaborative ratings and genre similarity when available.

## 1. Requirements
- Python 3.10+
- Node.js 18+
- Internet connection for the initial dataset download and optional Google Fonts.

## 2. Download the dataset
Download `ml-latest-small.zip` from:
https://grouplens.org/datasets/movielens/latest/

Extract it. Place the extracted `ml-latest-small` folder inside `backend/`, so these paths exist:
- `backend/ml-latest-small/movies.csv`
- `backend/ml-latest-small/ratings.csv`

If your extraction creates a nested folder, move the inner folder so the CSV files are at the paths above.

## 3. Start the Python API
Windows PowerShell:
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

If PowerShell blocks activation, use:
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## 4. Start React
Open a second terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the local URL Vite prints, normally http://localhost:5173.

## 5. How the hybrid approach works
- Collaborative component: looks at ratings from users with similar rating patterns.
- Content component: compares genre vectors for the target movie and movies already rated by the selected user.
- If one component is unavailable, the system falls back to the available component; for cold-start users it uses movie averages.
- The live score blends collaborative and content scores at 70% / 30% when both are available.

## 6. Important evaluation note
The API's displayed MAE/RMSE currently measure a movie-average baseline on a held-out test split, not the exact hybrid predictor. Do not report those metrics as hybrid-model performance. For a formal report, add a held-out evaluation loop that calls the same hybrid scoring logic using only training ratings.

## 7. Project report suggestions
1. Abstract
2. Problem statement
3. Objectives
4. Existing and proposed system
5. Dataset description
6. System architecture
7. Algorithm / methodology
8. Implementation
9. Results and screenshots
10. MAE and RMSE evaluation
11. Limitations and future scope
12. Conclusion

## Limitations
- The profile selector uses anonymized MovieLens user IDs, not real accounts.
- Movie poster art is generated with CSS; the app does not fetch copyrighted poster images.
- This is a learning/demo project, not a production recommender.
