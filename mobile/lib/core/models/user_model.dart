class User {
  final String id;
  final String? memberId;
  final String fullName;
  final String email;
  final String mobile;
  final String role;
  final String? panNumber;
  final String? aadhaarNumber;
  final String kycStatus;
  final int creditScore;
  final String? profileImageUrl;
  final String? referralCode;
  final String? address;
  final String? city;
  final String? state;
  final String? pincode;
  final String? dateOfBirth;
  final String? gender;
  final String? nomineeName;
  final String? nomineeRelationship;
  final bool nomineeVerified;
  final String? bankAccountNumber;
  final String? bankIfscCode;
  final String? bankName;
  final String? currentAddress;
  final String? currentCity;
  final String? currentState;
  final String? currentPincode;
  final String? profileEditStatus;
  final String? profileEditRejectionReason;
  final List<String>? profileEditRejectionFields;
  final Map<String, dynamic>? raw;

  User({
    required this.id,
    this.memberId,
    required this.fullName,
    required this.email,
    required this.mobile,
    required this.role,
    this.panNumber,
    this.aadhaarNumber,
    required this.kycStatus,
    required this.creditScore,
    this.profileImageUrl,
    this.referralCode,
    this.address,
    this.city,
    this.state,
    this.pincode,
    this.dateOfBirth,
    this.gender,
    this.nomineeName,
    this.nomineeRelationship,
    this.nomineeVerified = false,
    this.bankAccountNumber,
    this.bankIfscCode,
    this.bankName,
    this.currentAddress,
    this.currentCity,
    this.currentState,
    this.currentPincode,
    this.profileEditStatus,
    this.profileEditRejectionReason,
    this.profileEditRejectionFields,
    this.raw,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      memberId: json['member_id'],
      fullName: json['full_name'],
      email: json['email'],
      mobile: json['mobile'],
      role: json['role'],
      panNumber: json['pan_number'],
      aadhaarNumber: json['aadhaar_number'],
      kycStatus: json['kyc_status'] ?? 'pending',
      creditScore: json['credit_score'] ?? 500,
      profileImageUrl: json['profile_image_url'],
      referralCode: json['referral_code'],
      address: json['address'],
      city: json['city'],
      state: json['state'],
      pincode: json['pincode'],
      dateOfBirth: json['date_of_birth'],
      gender: json['gender'],
      nomineeName: json['nominee_name'],
      nomineeRelationship: json['nominee_relationship'],
      nomineeVerified: json['nominee_verified'] == true,
      bankAccountNumber: json['bank_account_number'],
      bankIfscCode: json['bank_ifsc_code'],
      bankName: json['bank_name'],
      currentAddress: json['current_address'],
      currentCity: json['current_city'],
      currentState: json['current_state'],
      currentPincode: json['current_pincode'],
      profileEditStatus: json['profile_edit_status'],
      profileEditRejectionReason: json['profile_edit_rejection_reason'],
      profileEditRejectionFields: (json['profile_edit_rejection_fields'] as List?)
          ?.map((e) => e.toString())
          .toList(),
      raw: json,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'member_id': memberId,
      'full_name': fullName,
      'email': email,
      'mobile': mobile,
      'role': role,
      'pan_number': panNumber,
      'aadhaar_number': aadhaarNumber,
      'kyc_status': kycStatus,
      'credit_score': creditScore,
      'profile_image_url': profileImageUrl,
      'referral_code': referralCode,
      'address': address,
      'city': city,
      'state': state,
      'pincode': pincode,
      'date_of_birth': dateOfBirth,
      'gender': gender,
      'nominee_name': nomineeName,
      'nominee_relationship': nomineeRelationship,
      'nominee_verified': nomineeVerified,
      'bank_account_number': bankAccountNumber,
      'bank_ifsc_code': bankIfscCode,
      'bank_name': bankName,
      'current_address': currentAddress,
      'current_city': currentCity,
      'current_state': currentState,
      'current_pincode': currentPincode,
      'profile_edit_status': profileEditStatus,
      'profile_edit_rejection_reason': profileEditRejectionReason,
      'profile_edit_rejection_fields': profileEditRejectionFields,
    };
  }
}
