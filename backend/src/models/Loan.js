const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  loan_number: { type: String, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup' },
  
  // Loan details
  loan_type: { type: String, enum: ['chit_loan', 'personal_loan', 'emergency_loan'], default: 'chit_loan' },
  requested_amount: { type: Number, required: true },
  approved_amount: { type: Number },
  interest_rate: { type: Number, default: 12 }, // Annual %
  tenure_months: { type: Number, required: true },
  emi_amount: { type: Number },
  
  // Status workflow
  status: { 
    type: String, 
    enum: ['requested', 'under_review', 'approved', 'disbursed', 'active', 'closed', 'rejected', 'defaulted'],
    default: 'requested' 
  },
  
  // Dates
  requested_at: { type: Date, default: Date.now },
  reviewed_at: Date,
  approved_at: Date,
  disbursed_at: Date,
  closed_at: Date,
  
  // Admin fields
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejection_reason: String,
  admin_notes: String,
  
  // Repayment tracking
  total_paid: { type: Number, default: 0 },
  outstanding_amount: { type: Number, default: 0 },
  next_emi_date: Date,
  
  // Purpose
  purpose: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

loanSchema.pre('save', async function (next) {
  if (this.isNew && !this.loan_number) {
    const count = await mongoose.model('Loan').countDocuments();
    this.loan_number = 'LN' + String(count + 1).padStart(5, '0');
  }
  // Calculate EMI if approved
  if (this.approved_amount && this.interest_rate && this.tenure_months && !this.emi_amount) {
    const P = this.approved_amount;
    const r = this.interest_rate / 12 / 100;
    const n = this.tenure_months;
    if (r > 0) {
      this.emi_amount = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    } else {
      this.emi_amount = Math.round(P / n);
    }
  }
  next();
});

const Loan = mongoose.model('Loan', loanSchema);
module.exports = Loan;
