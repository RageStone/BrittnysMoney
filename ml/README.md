# ML Signal Confidence API (Integrated)

This directory contains the machine learning backend for signal confidence scoring.

## 1. Prepare Data
- Export your Google Sheet as `signals.csv` and place it in this directory (`ml/`).

## 2. Train the Model
```
cd ml
pip install -r requirements.txt
python train_model.py
```
This will output evaluation metrics and save `model.pkl`.

## 3. Run the API
```
uvicorn api:app --reload
```
The API will be available at http://127.0.0.1:8000

## 4. Predict
Send a POST request to `/predict` with your signal features as JSON.

## 5. Retrain
- Re-run `train_model.py` as you collect more data.

## 6. Notes
- The API is now part of your Next.js project for easier integration and deployment. 