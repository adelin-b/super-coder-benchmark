I need the complete specification to implement this correctly. You've provided the title and a brief description, but I need the detailed spec that includes:

1. **Function/class names and signatures** — What exactly should be exported?
2. **Input parameters and types** — What data do the functions accept?
3. **Output format** — What should they return?
4. **Business logic** — How should proration be calculated? (e.g., exact day count, 30-day months, fiscal periods?)
5. **Validation rules** — Which inputs should throw errors?
6. **Edge cases** — How to handle leap years, partial months, etc.?

For example, a complete spec might look like:
- Export `calculateProration(startDate, endDate, monthlyCharge)` → returns prorated amount
- Export `splitCharge(startDate, endDate, amount, newStartDate)` → returns refund/charge adjustment
- Throw Error if date range is invalid, amounts are negative, etc.

Could you please provide the full specification document?