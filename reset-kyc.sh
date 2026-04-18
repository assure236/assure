#!/bin/bash
cd /var/www/assurechitfunds/backend
mongo assure_chitfunds <<'EOF'
db.users.updateOne(
  {email: "padarthidhanus@gmail.com"},
  {
    $set: {kyc_status: "not_verified"},
    $unset: {
      aadhar_number: "",
      pan_number: "",
      aadhar_front: "",
      aadhar_back: "",
      pan_card: ""
    }
  }
)
EOF
echo "KYC Reset Complete"
