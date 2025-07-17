import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, roc_auc_score, brier_score_loss
from sklearn.preprocessing import LabelEncoder
import joblib

# 1. Load data
# Export your Google Sheet as signals.csv in this directory
csv_path = "signals.csv"
df = pd.read_csv(csv_path)

# 2. Clean and preprocess
df = df.dropna(subset=["status"])  # Remove rows without outcome
df = df[df["status"].isin(["WIN", "LOSS"])]
df = df.fillna(0)

# 3. Feature selection
indicator_cols = [
    "rsi", "stoch", "williams", "cci", "atr", "sma", "ema", "momentum",
    "macd", "macdSignal", "macdHist", "bbUpper", "bbLower", "bbMiddle",
    "adx", "obv", "mfi", "stochrsi"
]
cat_cols = ["pair", "timeframe", "direction"]
for col in cat_cols:
    df[col] = LabelEncoder().fit_transform(df[col].astype(str))

features = indicator_cols + cat_cols
X = df[features]
# Ensure all features are numeric
X = X.apply(pd.to_numeric, errors='coerce').fillna(0)
y = (df["status"] == "WIN").astype(int)

# 4. Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 5. Train model
base_model = XGBClassifier(n_estimators=100, use_label_encoder=False, eval_metric='logloss')
base_model.fit(X_train, y_train)
# Save the fitted XGBoost model for SHAP
joblib.dump(base_model, "xgb_model.pkl")

calibrated_model = CalibratedClassifierCV(base_model, method='isotonic', cv=3)
calibrated_model.fit(X_train, y_train)

# 6. Evaluate
y_pred = calibrated_model.predict(X_test)
y_prob = calibrated_model.predict_proba(X_test)[:, 1]
print("Accuracy:", accuracy_score(y_test, y_pred))
print("ROC AUC:", roc_auc_score(y_test, y_prob))
print("Brier score:", brier_score_loss(y_test, y_prob))

# 7. Save model
joblib.dump((calibrated_model, features, cat_cols), "model.pkl")
print("Model saved to model.pkl and xgb_model.pkl") 