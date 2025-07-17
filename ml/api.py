from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import shap
import xgboost as xgb
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. For production, specify allowed origins.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model, features, cat_cols = joblib.load("model.pkl")
xgb_model = joblib.load("xgb_model.pkl")
explainer = shap.TreeExplainer(xgb_model)

class SignalInput(BaseModel):
    rsi: float
    stoch: float
    williams: float
    cci: float
    atr: float
    sma: float
    ema: float
    momentum: float
    macd: float
    macdSignal: float
    macdHist: float
    bbUpper: float
    bbLower: float
    bbMiddle: float
    adx: float
    obv: float
    mfi: float
    stochrsi: float
    pair: int  # Use the same encoding as in training!
    timeframe: int
    direction: int

@app.post("/predict")
def predict(signal: SignalInput):
    try:
        X = pd.DataFrame([signal.dict()])
        proba = model.predict_proba(X[features])[:, 1][0]
        # SHAP explanation
        shap_values = explainer.shap_values(X[features])
        # Get top 3 features by absolute SHAP value
        abs_shap = [(features[i], float(abs(shap_values[0][i]))) for i in range(len(features))]
        abs_shap.sort(key=lambda x: x[1], reverse=True)
        top3 = abs_shap[:3]
        explanation = [
            {"feature": f, "impact": float(shap_values[0][features.index(f)])}
            for f, _ in top3
        ]
        return {"confidence": float(proba), "explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Batch prediction
class BatchInput(BaseModel):
    signals: list[SignalInput]

@app.post("/predict_batch")
def predict_batch(batch: BatchInput):
    try:
        X = pd.DataFrame([s.dict() for s in batch.signals])
        proba = model.predict_proba(X[features])[:, 1]
        return {"confidences": proba.tolist()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 