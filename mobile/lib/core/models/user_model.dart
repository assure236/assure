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
    };
  }
}
