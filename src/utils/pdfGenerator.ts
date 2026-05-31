import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction, Debt, Loan } from '../hooks/useLocalStore';

interface PDFReportData {
  monthName: string;
  userEmail: string;
  totalIncome: number;
  totalExpenses: number;
  totalEmi: number;
  totalBorrowed: number;
  totalLent: number;
  netDiscretionary: number;
  transactions: Transaction[];
  categoryBudgets: Record<string, number>;
  customCategories: { name: string; emoji: string; type: 'income' | 'expense' }[];
  debts: Debt[];
  loans: Loan[];
}

export async function generateBudgetReportPDF(data: PDFReportData): Promise<void> {
  const {
    monthName,
    userEmail,
    totalIncome,
    totalExpenses,
    totalEmi,
    totalBorrowed,
    totalLent,
    netDiscretionary,
    transactions,
    categoryBudgets,
    debts,
    loans
  } = data;

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

  // 1. Process Category Budgets rows
  const activeExpenseCategories = Array.from(
    new Set([
      ...transactions.filter(t => t.type === 'expense').map(t => t.category),
      ...Object.keys(categoryBudgets),
    ])
  );

  let categoryRowsHtml = '';
  activeExpenseCategories.forEach(cat => {
    const limit = categoryBudgets[cat] || 0;
    const spent = transactions
      .filter(t => t.category === cat && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = limit - spent;
    let statusClass = 'status-ok';
    let statusLabel = 'Under Budget';

    if (limit === 0) {
      statusClass = 'status-no-limit';
      statusLabel = 'No Limit Set';
    } else if (spent > limit) {
      statusClass = 'status-over';
      statusLabel = 'Over Budget';
    } else if (spent > limit * 0.75) {
      statusClass = 'status-warning';
      statusLabel = 'Warning (75%+)';
    }

    const pctStr = limit > 0 ? `${Math.round((spent / limit) * 100)}%` : 'N/A';

    categoryRowsHtml += `
      <tr>
        <td><strong>${cat}</strong></td>
        <td class="num">${limit > 0 ? formatCurrency(limit) : 'Not Configured'}</td>
        <td class="num font-red">${formatCurrency(spent)}</td>
        <td class="num ${remaining >= 0 ? 'font-green' : 'font-red'}">${limit > 0 ? formatCurrency(remaining) : '—'}</td>
        <td class="num">${pctStr}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      </tr>
    `;
  });

  if (activeExpenseCategories.length === 0) {
    categoryRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #8E8E93; padding: 20px;">No category budgets active for this month.</td></tr>`;
  }

  // 2. Separate Loans (Expense) and Investments (Income)
  const loanExpenseEntries = loans.filter(l => l.entry_type === 'expense' || !l.entry_type);
  const loanIncomeEntries = loans.filter(l => l.entry_type === 'income');

  // 2a. Process Loans and Borrowings
  let loanRowsHtml = '';
  loanExpenseEntries.forEach(loan => {
    loanRowsHtml += `
      <tr>
        <td><strong>${loan.name}</strong></td>
        <td class="num">${formatCurrency(loan.principal)}</td>
        <td class="num">${loan.annual_rate}%</td>
        <td class="num">${loan.tenure_months} Mo.</td>
        <td class="num font-red"><strong>${formatCurrency(loan.monthly_emi)} / mo</strong></td>
        <td><span class="status-badge status-over">Active Liability</span></td>
      </tr>
    `;
  });

  if (loanExpenseEntries.length === 0) {
    loanRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #8E8E93; padding: 20px;">No active loans or borrowings logged.</td></tr>`;
  }

  // 2b. Process Deposits and Investments
  let investmentRowsHtml = '';
  loanIncomeEntries.forEach(inv => {
    investmentRowsHtml += `
      <tr>
        <td><strong>${inv.name}</strong></td>
        <td class="num">${formatCurrency(inv.principal)}</td>
        <td class="num">${inv.annual_rate}%</td>
        <td class="num">${inv.tenure_months} Mo.</td>
        <td class="num font-green"><strong>${formatCurrency(inv.monthly_emi)} / mo</strong></td>
        <td><span class="status-badge status-ok">Active Return</span></td>
      </tr>
    `;
  });

  if (loanIncomeEntries.length === 0) {
    investmentRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #8E8E93; padding: 20px;">No active deposits or investments logged.</td></tr>`;
  }

  // 3. Process Debts list
  let debtRowsHtml = '';
  debts.forEach(debt => {
    const outstanding = debt.principal - debt.payment_progress;
    debtRowsHtml += `
      <tr>
        <td><strong>${debt.type === 'lending' ? 'Lent to' : 'Borrowed from'} ${debt.contact_name}</strong></td>
        <td><span class="status-badge ${debt.type === 'lending' ? 'status-ok' : 'status-warning'}">${debt.type === 'lending' ? 'Receivable' : 'Liability'}</span></td>
        <td class="num">${formatCurrency(debt.principal)}</td>
        <td class="num font-green">${formatCurrency(debt.payment_progress)}</td>
        <td class="num font-red"><strong>${formatCurrency(outstanding)}</strong></td>
        <td class="num">${debt.due_date ? new Date(debt.due_date).toLocaleDateString('en-US') : 'No due date'}</td>
      </tr>
    `;
  });

  if (debts.length === 0) {
    debtRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #8E8E93; padding: 20px;">No outstanding debts logged.</td></tr>`;
  }

  // 4. Itemized Transaction Ledger
  let txRowsHtml = '';
  transactions.forEach(tx => {
    const txDate = new Date(tx.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    txRowsHtml += `
      <tr>
        <td>${txDate}</td>
        <td><strong>${tx.category}</strong></td>
        <td><span class="status-badge ${tx.type === 'income' ? 'status-ok' : 'status-no-limit'}">${tx.type.toUpperCase()}</span></td>
        <td>${tx.account}</td>
        <td style="color: #6C6C72;">${tx.note || '—'}</td>
        <td class="num ${tx.type === 'income' ? 'font-green' : 'font-red'}">
          <strong>${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</strong>
        </td>
      </tr>
    `;
  });

  if (transactions.length === 0) {
    txRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #8E8E93; padding: 20px;">No transactions logged for this month.</td></tr>`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Money Manager Financial Report - ${monthName}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1C1C1E;
            background-color: #FFFFFF;
            margin: 0;
            padding: 40px;
            font-size: 13px;
            line-height: 1.5;
          }
          
          /* Header Layout */
          .report-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1FA89B;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #1FA89B;
            letter-spacing: -1px;
            margin: 0;
          }
          .brand-subtitle {
            font-size: 11px;
            color: #8E8E93;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 4px;
            margin-bottom: 0;
          }
          .report-meta {
            text-align: right;
          }
          .report-meta h1 {
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 5px 0;
            color: #1FA89B;
          }
          .report-meta p {
            margin: 2px 0;
            color: #8E8E93;
            font-size: 11px;
          }

          /* KPI summary block */
          .kpi-row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 35px;
          }
          .kpi-card {
            flex: 1;
            border: 1px solid #E5E5EA;
            border-radius: 8px;
            padding: 15px;
            background-color: #F8F8FA;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          .kpi-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #8E8E93;
            margin-bottom: 5px;
          }
          .kpi-value {
            font-size: 18px;
            font-weight: 700;
            color: #1C1C1E;
          }
          .kpi-border-blue { border-left: 4px solid #1FA89B; }
          .kpi-border-red { border-left: 4px solid #FF453A; }
          .kpi-border-green { border-left: 4px solid #30D158; }
          .kpi-border-orange { border-left: 4px solid #FF9500; }

          /* Sections */
          .section-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0A0A0C;
            margin-bottom: 12px;
            margin-top: 30px;
            border-bottom: 1px solid #E5E5EA;
            padding-bottom: 6px;
          }

          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #F2F2F7;
            text-align: left;
            padding: 10px;
            font-weight: 600;
            color: #48484A;
            border-bottom: 1px solid #D1D1D6;
          }
          td {
            padding: 10px;
            border-bottom: 1px solid #E5E5EA;
            color: #2C2C2E;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .num {
            text-align: right;
          }
          
          /* Color Helpers */
          .font-green { color: #30D158; }
          .font-red { color: #FF453A; }
          .font-blue { color: #1FA89B; }
          
          /* Badges */
          .status-badge {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 12px;
            display: inline-block;
          }
          .status-ok {
            background-color: #E8F8EE;
            color: #30D158;
          }
          .status-warning {
            background-color: #FFF3E5;
            color: #FF9500;
          }
          .status-over {
            background-color: #FFEBEB;
            color: #FF453A;
          }
          .status-no-limit {
            background-color: #F2F2F7;
            color: #8E8E93;
          }

          /* Footer */
          .report-footer {
            margin-top: 50px;
            border-top: 1px solid #E5E5EA;
            padding-top: 15px;
            text-align: center;
            color: #8E8E93;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="report-header">
          <div>
            <h2 class="brand-title">MONEY MANAGER</h2>
            <p class="brand-subtitle">Personal Wealth & Capital Ledger</p>
          </div>
          <div class="report-meta">
            <h1>Monthly Financial Report</h1>
            <p><strong>Reporting Cycle:</strong> ${monthName}</p>
            <p><strong>Account Profile:</strong> ${userEmail}</p>
            <p><strong>Report ID:</strong> RPT-${Date.now().toString().slice(-6)}</p>
          </div>
        </div>

        <!-- Health Summary Block -->
        <div class="kpi-row">
          <div class="kpi-card kpi-border-blue">
            <div class="kpi-title">Starting Net Income</div>
            <div class="kpi-value font-blue">${formatCurrency(totalIncome)}</div>
          </div>
          <div class="kpi-card kpi-border-red">
            <div class="kpi-title">Fixed Commitments (EMIs + Debts)</div>
            <div class="kpi-value font-red">${formatCurrency(totalEmi + totalBorrowed)}</div>
          </div>
          <div class="kpi-card kpi-border-orange">
            <div class="kpi-title">Logged Expenses</div>
            <div class="kpi-value font-red">${formatCurrency(totalExpenses)}</div>
          </div>
          <div class="kpi-card kpi-border-green">
            <div class="kpi-title">Discretionary Balance</div>
            <div class="kpi-value font-green">${formatCurrency(netDiscretionary)}</div>
          </div>
        </div>

        <!-- Category Budgets Table -->
        <h2 class="section-title">Category Outlay Limits & Allocations</h2>
        <table>
          <thead>
            <tr>
              <th>Expense Category</th>
              <th class="num">Configured Budget</th>
              <th class="num">Actual Ledger Spent</th>
              <th class="num">Remaining Allowance</th>
              <th class="num">Burn Rate (%)</th>
              <th>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRowsHtml}
          </tbody>
        </table>

        <!-- Active Installment Loans -->
        <h2 class="section-title">Loans & Borrowings</h2>
        <table>
          <thead>
            <tr>
              <th>Loan/Installment Description</th>
              <th class="num">Principal Balance</th>
              <th class="num">Interest Rate (APR)</th>
              <th class="num">Remaining Tenure</th>
              <th class="num">Monthly EMI Outlay</th>
              <th>Liability Status</th>
            </tr>
          </thead>
          <tbody>
            ${loanRowsHtml}
          </tbody>
        </table>

        <!-- Active Deposits & Investments -->
        <h2 class="section-title">Deposits & Investments</h2>
        <table>
          <thead>
            <tr>
              <th>Investment Description</th>
              <th class="num">Principal Amount</th>
              <th class="num">Annual Rate (ROI)</th>
              <th class="num">Term (Months)</th>
              <th class="num">Monthly Return Inflow</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${investmentRowsHtml}
          </tbody>
        </table>

        <!-- Outstanding Debts -->
        <h2 class="section-title">Debts Ledger (Receivables & Liabilities)</h2>
        <table>
          <thead>
            <tr>
              <th>Contact Ledger Party</th>
              <th>Debt Classification</th>
              <th class="num">Original Principal</th>
              <th class="num">Amount Repaid</th>
              <th class="num">Remaining Debt Due</th>
              <th class="num">Target Settlement Date</th>
            </tr>
          </thead>
          <tbody>
            ${debtRowsHtml}
          </tbody>
        </table>

        <!-- Monthly Itemized Ledger Log -->
        <h2 class="section-title">Itemized Transactions Log for ${monthName}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Audit Class</th>
              <th>Payment Channel</th>
              <th>Audit Remarks</th>
              <th class="num">Audit Value</th>
            </tr>
          </thead>
          <tbody>
            ${txRowsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div class="report-footer">
          <p>This report was generated by Money Manager on ${new Date().toLocaleString()}.</p>
          <p>© 2026 Money Manager. Confidential Personal Ledger.</p>
        </div>
      </body>
    </html>
  `;

  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html: htmlContent });
    } else {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Money Manager Financial Report - ${monthName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    }
  } catch (error) {
    console.warn('Primary PDF compilation failed, trying printAsync fallback:', error);
    try {
      await Print.printAsync({ html: htmlContent });
    } catch (fallbackError) {
      console.error('Fallback PDF compilation failed:', fallbackError);
      throw new Error('Could not compile PDF report. Please try again.');
    }
  }
}
