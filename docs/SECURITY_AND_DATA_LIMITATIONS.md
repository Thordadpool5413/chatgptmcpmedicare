# Security And Data Limitations

This project is intentionally built around free public CMS data and optional user supplied internal CSV data.

## What it can do

It can support national market intelligence using public CMS data, including hospice market share proxies, hospital discharge opportunity, nursing home opportunity, hospice quality positioning, provider identity lookup, and local admissions gap analysis.

## What it cannot do for free

It cannot provide exact hospital to hospice referral flow, exact physician to hospice referral flow, exact SNF to hospice referral flow, beneficiary level Medicare claims, CCW research files, VRDC data, CASPER or iQIES restricted provider reports, raw OASIS assessments, raw HOPE assessments, or Medicare Advantage encounter level referral movement.

## Internal admissions data

The admissions CSV should not include patient names, Social Security numbers, full medical record numbers, street addresses, dates of birth, or free text clinical notes.

Recommended fields:

```text
admit_date
patient_id
market
county
zip
referral_source
referral_source_type
facility_npi
physician_npi
payer
diagnosis_group
marketer
admission_status
```

Use anonymous patient IDs whenever possible.

## Interpretation rule

Public CMS data can show where opportunity is likely concentrated. Internal admissions data can show where your organization actually received referrals. The MCP can compare those two worlds, but it should not claim exact competitor referral leakage unless a verified internal or licensed claims source proves it.
