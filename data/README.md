# Clinical Pharmacokinetic Datasets

This folder contains clinical trial datasets for target-controlled infusion (TCI) pharmacokinetic modeling.

## 1. `Kaggle_PK_Remifentanil.csv`
Clinical trial cohort of 65 subjects administered intravenous remifentanil by computerized infusion pump.

### Column Schema:
- `rownames`: Sequence row index.
- `ID`: Unique record identifier.
- `Subject`: Subject identifier (1 to 65).
- `Time`: Event timestamp (minutes from start of study).
- `conc`: Measured arterial plasma remifentanil concentration ($C_p$ in $\text{ng/mL}$ / $\mu\text{g/L}$). Missing values (`NaN`) correspond to dosing records, which is standard in NONMEM format.
- `Rate`: Infusion pump delivery rate ($\mu\text{g/min}$).
- `Amt`: Rapid bolus amount ($\mu\text{g}$).
- `Age`: Subject chronological age (years).
- `Sex`: Subject biologic sex (`Male` or `Female`).
- `Ht`: Height in centimeters ($\text{cm}$).
- `Wt`: Total body weight in kilograms ($\text{kg}$).
- `BSA`: Body surface area ($\text{m}^2$, Mosteller formula).
- `LBM`: Lean body mass ($\text{kg}$, James 1976 equation).

### Lower Limit of Quantification (LLOQ)
- Assumed standard remifentanil LLOQ is $0.1\,\text{ng/mL}$. Concentrations below LLOQ or zero values are safely handled to prevent infinite percentage errors.

## 2. `Ross_remi.txt`
NONMEM data table from the Ross et al. remifentanil clinical investigation.
