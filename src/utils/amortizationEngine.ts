/**
 * Amortization & Installment Calculation Engine
 * Calculates Monthly Equated Installments (EMI) and generates repayment schedules.
 */

export interface AmortizationScheduleRow {
  monthIndex: number;
  paymentDate: string;
  emi: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;
}

export interface AmortizationSummary {
  monthlyInstallment: number;
  totalInterest: number;
  totalRepayment: number;
  schedule: AmortizationScheduleRow[];
}

/**
 * Calculates the Equated Monthly Installment (EMI) using the standard amortization formula.
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 * @param principal The loan amount ($)
 * @param annualRate Nominal annual interest rate (%)
 * @param tenureMonths Loan duration in months
 */
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  
  const monthlyRate = annualRate / 12 / 100; // Convert to decimal monthly rate

  // If interest rate is zero, simple division of principal over tenure
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }

  const emi = 
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  return Number(emi.toFixed(2));
}

/**
 * Generates an interactive month-by-month payment schedule showing Principal vs. Interest over the tenure.
 *
 * @param principal The loan amount ($)
 * @param annualRate Nominal annual interest rate (%)
 * @param tenureMonths Loan duration in months
 * @param startDate The date of the first installment payment
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  startDate: Date = new Date()
): AmortizationSummary {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const monthlyRate = annualRate / 12 / 100;
  
  let remainingBalance = principal;
  let totalInterest = 0;
  const schedule: AmortizationScheduleRow[] = [];

  for (let month = 1; month <= tenureMonths; month++) {
    let interestPaid = 0;
    let principalPaid = 0;

    if (monthlyRate === 0) {
      interestPaid = 0;
      principalPaid = remainingBalance < emi ? remainingBalance : emi;
    } else {
      interestPaid = remainingBalance * monthlyRate;
      interestPaid = Number(interestPaid.toFixed(2));
      
      principalPaid = emi - interestPaid;
      principalPaid = Number(principalPaid.toFixed(2));
    }

    // Adjust for minor float rounding errors in the final month
    if (month === tenureMonths || remainingBalance - principalPaid < 0) {
      principalPaid = remainingBalance;
      remainingBalance = 0;
    } else {
      remainingBalance = Number((remainingBalance - principalPaid).toFixed(2));
    }

    totalInterest += interestPaid;

    // Calculate current payment date
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(startDate.getMonth() + month - 1);
    const dateString = paymentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });

    schedule.push({
      monthIndex: month,
      paymentDate: dateString,
      emi: Number((principalPaid + interestPaid).toFixed(2)),
      interestPaid,
      principalPaid,
      remainingBalance,
    });
  }

  const totalRepayment = Number((principal + totalInterest).toFixed(2));

  return {
    monthlyInstallment: emi,
    totalInterest: Number(totalInterest.toFixed(2)),
    totalRepayment,
    schedule,
  };
}

/**
 * Calculates the monthly interest yield for savings deposits.
 *
 * @param principal Initial savings balance ($)
 * @param annualRate Annual percentage yield / interest rate (%)
 * @param isCompounded Whether interest compounds monthly or stays simple
 */
export function calculateSavingsInterestYield(
  principal: number,
  annualRate: number,
  isCompounded: boolean = true
): number {
  if (principal <= 0 || annualRate <= 0) return 0;
  const monthlyRate = annualRate / 12 / 100;
  
  if (isCompounded) {
    // Return interest accumulated in one month with monthly compounding: P * ((1 + r)^1 - 1)
    return Number((principal * monthlyRate).toFixed(2));
  } else {
    // Simple interest for one month
    return Number((principal * (annualRate / 100) / 12).toFixed(2));
  }
}
