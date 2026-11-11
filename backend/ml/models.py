"""
ml/models.py — Estimator factory for all 8 PK Machine Learning Residual Models.
"""
from __future__ import annotations
from typing import Dict, Any
from sklearn.linear_model import BayesianRidge, Ridge
from sklearn.svm import SVR
from sklearn.ensemble import (
    RandomForestRegressor,
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    StackingRegressor,
    HistGradientBoostingRegressor
)

MODEL_DESCRIPTIONS = {
    "BayesianCompartment": "Bayesian Ridge L2-regularized linear model on mechanistic features",
    "SupportVectorRobust": "Support Vector Regression with RBF kernel and Huber-like epsilon tube",
    "RandomForest": "Random Forest ensemble of 150 randomized decision trees",
    "ExtraTrees": "Extremely Randomized Trees with randomized node thresholding",
    "GradientBoosting": "Stage-wise Gradient Boosted regression trees with shrinkage",
    "XGBoost": "Scalable extreme gradient boosted tree ensemble with histogram binning",
    "CatBoost": "Symmetric decision tree boosting optimized for tabular covariates",
    "StackingEnsemble": "Stacking meta-regressor combining top tree learners via Ridge regression",
    "Minto": "Minto et al. (1997) 3-compartment + effect-site uncorrected baseline"
}

def get_model_instances(random_state: int = 42) -> Dict[str, Any]:
    """
    Construct all 8 model estimators with robust fallbacks.
    """
    rf = RandomForestRegressor(
        n_estimators=150, max_depth=12, min_samples_leaf=3,
        random_state=random_state, n_jobs=-1
    )
    et = ExtraTreesRegressor(
        n_estimators=150, max_depth=14, min_samples_leaf=2,
        random_state=random_state, n_jobs=-1
    )
    gbm = GradientBoostingRegressor(
        n_estimators=200, learning_rate=0.04, max_depth=3,
        subsample=0.85, random_state=random_state
    )
    svr = SVR(kernel="rbf", C=10.0, epsilon=0.1, gamma="scale")
    bridge = BayesianRidge(alpha_1=1e-4, alpha_2=1e-4, lambda_1=1e-4, lambda_2=1e-4)

    # XGBoost
    try:
        import xgboost as xgb
        xgb_est = xgb.XGBRegressor(
            n_estimators=200, learning_rate=0.05, max_depth=4,
            subsample=0.8, colsample_bytree=0.8, random_state=random_state,
            n_jobs=-1, verbosity=0
        )
    except Exception:
        xgb_est = HistGradientBoostingRegressor(
            max_iter=200, learning_rate=0.05, max_depth=4,
            random_state=random_state
        )

    # CatBoost
    try:
        import catboost as cb
        cb_est = cb.CatBoostRegressor(
            iterations=200, learning_rate=0.05, depth=5,
            subsample=0.8, random_seed=random_state, verbose=0
        )
    except Exception:
        cb_est = GradientBoostingRegressor(
            n_estimators=200, learning_rate=0.05, max_depth=5,
            subsample=0.8, random_state=random_state
        )

    # Stacking ensemble
    stack_base = [
        ("rf", rf),
        ("et", et),
        ("gbm", gbm),
        ("xgb", xgb_est)
    ]
    stacking = StackingRegressor(
        estimators=stack_base,
        final_estimator=Ridge(alpha=1.0),
        cv=3,
        n_jobs=-1
    )

    models = {
        "BayesianCompartment": bridge,
        "SupportVectorRobust": svr,
        "RandomForest": rf,
        "ExtraTrees": et,
        "GradientBoosting": gbm,
        "XGBoost": xgb_est,
        "CatBoost": cb_est,
        "StackingEnsemble": stacking
    }

    return models
