db.users.updateOne(
  {email: "padarthidhanush0@gmail.com"},
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
