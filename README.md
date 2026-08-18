# PrismBank — Banking Database Management System

A self-contained banking database system with a black / pink / blue theme and a generated logo.

## Features

- **Random sample database** (seeded, persisted in localStorage)
  - 10 branches (IFSC, MICR, rates)
  - 26 employees (salary, department, branch)
  - 40 customers (name, ID, contact number, KYC)
  - 53 accounts (Savings / Current / FD / Salary)
  - 120 transactions (Deposit, Withdrawal, Transfer, UPI, Interest)
  - 16 loans (Home / Personal / Car / Education / Business / Gold)
- **OTP verification** — login and high-value transactions (demo OTP shown on screen)
- **Admin dashboard** — stats, top branches, recent ledger activity
- **CRUD** for customers, branches and employees (add / edit / delete)
- **Loans** — apply for a loan, approve / reject / close, EMI calculator
- **Transactions** — deposit, withdraw, transfer & UPI pay with live balance
- **Reports** — monthly volume chart, loan book, account mix, top customers
- **Global search** across all tables

## Run locally

```bash
# option 1 — just open the file
open Nova-Bank/index.html

# option 2 — localhost server
cd Nova-Bank
python -m http.server 8000
# then visit http://localhost:8000
```

The app opens directly with an auto admin session (no login required).

## Tech

- Plain HTML + CSS + JavaScript (no frameworks, no build step)
- Data persists in `localStorage`; a "Reset Sample Data" button reseeds the random database

> Legacy files in this repo root (`index.html`, `css/`, `js/`, `banking-simple.html`) belong to an older NovaBank demo. The PrismBank system lives entirely in `Nova-Bank/`.

## Project structure

```
Nova-Bank/
├── index.html    # app shell, login/OTP UI, modals
├── css/style.css # black/pink/blue theme
└── js/
    ├── data.js   # seeded random database + helpers
    └── app.js    # views, CRUD, OTP, transactions, reports
```

> Demo project — all data is randomly generated. No real banking is performed.
