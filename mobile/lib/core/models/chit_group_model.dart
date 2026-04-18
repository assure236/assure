class ChitGroup {
  final String id;
  final String groupNumber;
  final String groupName;
  final int totalMembers;
  final double chitValue;
  final double monthlyInstallment;
  final int durationMonths;
  final String status;
  final int currentMonth;
  final DateTime commencementDate;

  ChitGroup({
    required this.id,
    required this.groupNumber,
    required this.groupName,
    required this.totalMembers,
    required this.chitValue,
    required this.monthlyInstallment,
    required this.durationMonths,
    required this.status,
    required this.currentMonth,
    required this.commencementDate,
  });

  factory ChitGroup.fromJson(Map<String, dynamic> json) {
    return ChitGroup(
      id: json['_id'] ?? json['id'],  // MongoDB uses _id
      groupNumber: json['group_number'],
      groupName: json['group_name'],
      totalMembers: json['total_members'],
      chitValue: double.parse(json['chit_value'].toString()),
      monthlyInstallment: double.parse(json['monthly_installment'].toString()),
      durationMonths: json['duration_months'],
      status: json['status'],
      currentMonth: json['current_month'] ?? 0,
      commencementDate: json['commencement_date'] != null
          ? DateTime.tryParse(json['commencement_date'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    '_id': id,
    'group_number': groupNumber,
    'group_name': groupName,
    'total_members': totalMembers,
    'chit_value': chitValue,
    'monthly_installment': monthlyInstallment,
    'duration_months': durationMonths,
    'status': status,
    'current_month': currentMonth,
    'commencement_date': commencementDate.toIso8601String(),
  };
}
