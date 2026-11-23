export interface SeniorBenefit {
  id: string;
  tag: string;
  title: string;
  description: string;
  detail: string;
  icon: 'knee' | 'spine' | 'sleep' | 'community';
}

export interface StoryChapter {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  imageKey: 'studioSunlit' | 'masterSupine' | 'studioPanorama' | 'studioPlants';
  imageAlt: string;
  caption: string;
}

export interface MasterProfile {
  name: string;
  role: string;
  specialty: string;
  description: string;
  imageKey: 'masterGauri' | 'masterSupine' | 'interpreter' | 'masterWheel';
  imageAlt: string;
}

export interface ScheduleSlot {
  time: string;
  period: 'morning-early' | 'morning' | 'afternoon';
  periodLabel: string;
  sessions: {
    day: string;
    name: string;
    teacher: string;
    seniorFriendly: boolean;
    note?: string;
  }[];
}

export interface Testimonial {
  quote: string;
  author: string;
  source: string;
  date: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const SENIOR_BENEFITS: SeniorBenefit[] = [
  {
    id: 'khop-goi',
    tag: 'An toàn xương khớp',
    title: 'Êm ái khớp gối, không ép biên độ',
    description:
      'Với cô chú có dấu hiệu thoái hóa khớp gối hay ngại leo cầu thang, mỗi động tác đều được điều chỉnh nhẹ nhàng cùng ghế, gạch yoga và dây hỗ trợ.',
    detail: 'Giảm áp lực lên đầu gối — tăng độ vững cho cơ đùi và sự linh hoạt hàng ngày.',
    icon: 'knee',
  },
  {
    id: 'lung-vai-gay',
    tag: 'Giảm đau mỏi mạn tính',
    title: 'Nhẹ thắt lưng, mềm cổ vai gáy',
    description:
      'Các bài tập Hatha truyền thống, Stretching và Wall Yoga giúp kéo giãn cột sống có kiểm soát, xoa dịu cơn đau lưng mạn tính và tình trạng cứng khớp buổi sáng.',
    detail: 'Giáo viên Ấn Độ trực tiếp quan sát và nắn chỉnh định tuyến an toàn từng tư thế.',
    icon: 'spine',
  },
  {
    id: 'giac-ngu-an-yen',
    tag: 'Thư giãn hệ thần kinh',
    title: 'Ngủ sâu giấc, tâm trí thư thái',
    description:
      'Kết hợp vận động dịu nhẹ cùng lớp thở chuyên sâu, thiền nến Tratak và thanh lọc Jal Neti giúp điều hòa nhịp thở, giảm trằn trọc khó ngủ về đêm.',
    detail: 'Rời khỏi thảm tập với cảm giác nhẹ nhõm, bình an và tràn đầy sinh khí.',
    icon: 'sleep',
  },
  {
    id: 'cong-dong',
    tag: 'Niềm vui tuổi hưu',
    title: 'Cộng đồng vui khỏe, gắn kết mỗi ngày',
    description:
      'Không gian văn minh, ấm áp với đông đảo học viên trung niên và người đã nghỉ hưu tại Biên Hòa. Mỗi buổi tập là một cuộc gặp gỡ vui vẻ, tích cực.',
    detail: 'Duy trì thói quen chăm sóc sức khỏe bền vững — “mỗi ngày một lớp là đủ”.',
    icon: 'community',
  },
];

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    number: '01',
    eyebrow: 'Không gian 800m² chuẩn quốc tế',
    title: 'Rộng rãi, ngập nắng sớm và tách biệt ồn ào phố thị',
    description:
      'Với diện tích hơn 800m² được thiết kế chuyên sâu riêng cho bộ môn Yoga, sàn gỗ ấm áp, trần cao thoáng khí và gương sáng rộng giúp cô chú hít thở sâu trong một không gian thật sự trong lành ngay giữa Biên Hòa.',
    highlights: [
      'Sàn gỗ sạch sẽ, không gian thoáng đãng, không bí bách',
      'Vị trí thuận tiện ngay sau lưng Big C Đồng Nai, dễ di chuyển',
      'Hệ thống tủ đồ cá nhân cao cấp, gọn gàng và an toàn',
    ],
    imageKey: 'studioSunlit',
    imageAlt: 'Không gian phòng tập Power Yoga Đồng Nai 800m2 ngập ánh nắng tự nhiên và sàn gỗ sạch đẹp tại Biên Hòa',
    caption: 'Phòng tập ngập tràn ánh sáng tự nhiên — nơi bắt đầu ngày mới thật bình an.',
  },
  {
    number: '02',
    eyebrow: 'Giáo viên Ấn Độ & Phiên dịch tại lớp',
    title: 'Dạy tận tay, phiên dịch tiếng Việt rõ ràng từng nhịp thở',
    description:
      'Cô chú hoàn toàn không cần lo lắng về rào cản ngôn ngữ. Đội ngũ Master đến từ cái nôi Yoga Ấn Độ luôn giảng dạy song hành cùng phiên dịch viên tiếng Việt tận tâm, theo sát thể trạng riêng của từng người.',
    highlights: [
      'Master Ấn Độ giàu kinh nghiệm trị liệu & định tuyến chuẩn xác',
      'Phiên dịch tiếng Việt trực tiếp trong suốt buổi tập',
      'Điều chỉnh động tác riêng theo tình trạng gối, lưng và huyết áp',
    ],
    imageKey: 'masterSupine',
    imageAlt: 'Giáo viên Ấn Độ tại Power Yoga Đồng Nai ân cần hướng dẫn học viên giãn cơ nhẹ nhàng trên thảm',
    caption: 'Master Ấn Độ theo sát từng nhịp thở và biên độ an toàn của học viên.',
  },
  {
    number: '03',
    eyebrow: 'Trang bị đầy đủ dụng cụ hỗ trợ',
    title: 'Chỉ cần mang tâm thế thoải mái — mọi dụng cụ đã sẵn sàng',
    description:
      'Power Yoga trang bị đầy đủ thảm tập cao cấp, gạch kê, dây kéo, gậy gỗ, vòng yoga, bóng tập và võng tập được vệ sinh sạch sẽ mỗi ngày. Dụng cụ hỗ trợ là chìa khóa giúp người lớn tuổi tập êm, đúng kỹ thuật mà không đau khớp.',
    highlights: [
      'Thảm, gạch, vòng, gậy gỗ, bóng và dây hỗ trợ chuẩn phòng tập',
      'Không cần mua sắm hay mang vác đồ cồng kềnh từ nhà',
      'Luôn được lau dọn, khử khuẩn sạch sẽ sau mỗi ca tập',
    ],
    imageKey: 'studioPanorama',
    imageAlt: 'Toàn cảnh phòng tập Power Yoga Đồng Nai với thảm, vòng yoga, gạch, gậy gỗ và bóng tập sắp xếp ngay ngắn',
    caption: 'Đầy đủ thảm, gạch, vòng và gậy hỗ trợ được chuẩn bị ngăn nắp trước giờ tập.',
  },
  {
    number: '04',
    eyebrow: 'Thư giãn & Phục hồi sau buổi tập',
    title: 'Phòng xông hơi đá Mosaic & Giường đá muối Himalaya',
    description:
      'Điểm chạm khác biệt mà học viên lớn tuổi yêu thích nhất tại Power Yoga Đồng Nai: sau giờ vận động nhẹ nhàng, cơ thể được thư giãn sâu với phòng xông hơi đá ghép Mosaic và giường đá muối Himalaya giúp ấm cơ thể, lưu thông khí huyết và ngủ ngon hơn.',
    highlights: [
      'Phòng xông hơi đá ghép Mosaic sang trọng, thư giãn gân cốt',
      'Giường đá muối Himalaya ấm áp, hỗ trợ thải độc & giảm nhức mỏi',
      'Trọn vẹn quy trình chăm sóc Thân – Tâm trong một điểm đến',
    ],
    imageKey: 'studioPlants',
    imageAlt: 'Góc phòng tập tràn ngập cây xanh, ánh nắng ấm áp và không gian thư giãn yên bình tại Power Yoga Đồng Nai',
    caption: 'Không gian xanh mát kết hợp tiện ích xông hơi Mosaic & giường đá muối Himalaya.',
  },
];

export const MASTERS: MasterProfile[] = [
  {
    name: 'Master Govinda',
    role: 'Giáo viên chính từ Ấn Độ',
    specialty: 'Hatha · Wall Yoga · Stick Yoga · Jal Neti · Chuyên sâu 90 phút',
    description:
      'Nổi bật với phong cách giảng dạy điềm đạm, chú trọng hơi thở, kỹ thuật mở khớp an toàn cùng dụng cụ (tường, gậy, vòng) và các buổi thanh lọc Jal Neti, Thiền nến Tratak.',
    imageKey: 'masterSupine',
    imageAlt: 'Master Ấn Độ hướng dẫn học viên giãn cơ nhẹ nhàng trên thảm tại Power Yoga Đồng Nai',
  },
  {
    name: 'Master Gauri',
    role: 'Giáo viên chính từ Ấn Độ',
    specialty: 'Gentle Yoga · Hatha Truyền Thống · Mở Vai & Nghiêng Lườn · Thiền Nến',
    description:
      'Tận tâm và tinh tế trong từng nhịp chuyển động. Các lớp Gentle Yoga và Hatha truyền thống của thầy rất được cô chú mới bắt đầu yêu thích vì sự chậm rãi, dễ theo.',
    imageKey: 'masterGauri',
    imageAlt: 'Master Gauri hướng dẫn học viên giữ thăng bằng an toàn cùng gậy gỗ và đệm kê gối tại Power Yoga Đồng Nai',
  },
  {
    name: 'Đội Ngũ Phiên Dịch Tại Lớp',
    role: 'Phiên dịch tiếng Việt · Hỗ trợ học viên',
    specialty: 'Phiên dịch trực tiếp · Xóa tan rào cản ngôn ngữ · Chăm sóc học viên mới',
    description:
      'Đồng hành xuyên suốt cùng Master Govinda, Master Gauri và các Master Ấn Độ tại lớp, giúp cô chú nghe hiểu rõ ràng từng nhịp thở, cách đặt khớp an toàn và hoàn toàn an tâm ngay từ buổi tập đầu tiên.',
    imageKey: 'interpreter',
    imageAlt: 'Phiên dịch viên tiếng Việt thân thiện, tận tâm đồng hành cùng học viên tại Power Yoga Đồng Nai',
  },
];

export const SCHEDULE_SLOTS: ScheduleSlot[] = [
  {
    time: '05:00 – 06:00',
    period: 'morning-early',
    periodLabel: 'Sáng sớm',
    sessions: [
      { day: 'Thứ 2', name: 'Yoga cùng Myring', teacher: 'M. Govinda', seniorFriendly: true, note: 'Nhẹ nhàng, hỗ trợ giãn cơ' },
      { day: 'Thứ 4', name: 'Chuỗi Sức Mạnh (Ashtanga)', teacher: 'M. Gauri', seniorFriendly: false },
      { day: 'Thứ 5', name: 'Chuỗi Xoạc Dọc (Front Split)', teacher: 'M. Govinda', seniorFriendly: false },
      { day: 'Thứ 6', name: 'Mở Vai & Nghiêng Lườn', teacher: 'M. Gauri', seniorFriendly: true, note: 'Tốt cho cổ vai gáy' },
      { day: 'Thứ 7', name: 'Cơ Lõi (Core Yoga)', teacher: 'M. Gauri', seniorFriendly: false },
    ],
  },
  {
    time: '06:30 – 07:30',
    period: 'morning',
    periodLabel: 'Buổi sáng',
    sessions: [
      { day: 'Thứ 2', name: 'Chuỗi Nhẹ Nhàng (Gentle Yoga)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Rất phù hợp người lớn tuổi' },
      { day: 'Thứ 4', name: 'Chuỗi Phối Hợp (Mix Yoga)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Cân bằng toàn thân' },
      { day: 'Thứ 5', name: 'Chuỗi Truyền Thống (Hatha)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Chậm rãi, chuẩn hơi thở' },
      { day: 'Thứ 6', name: 'Mở Toàn Thân (Body Opening)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Giảm cứng khớp sáng sớm' },
      { day: 'Thứ 7', name: 'Mở Vai & Nghiêng Lườn', teacher: 'M. Gauri', seniorFriendly: true, note: 'Nhẹ nhàng vai gáy' },
      { day: 'Chủ Nhật', name: 'Jal Neti (Thanh Lọc Mũi)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Khơi thông hô hấp' },
    ],
  },
  {
    time: '08:00 – 09:00',
    period: 'morning',
    periodLabel: 'Buổi sáng',
    sessions: [
      { day: 'Thứ 2', name: 'Mở Vai & Nghiêng Lườn', teacher: 'M. Gauri', seniorFriendly: true, note: 'Khung giờ thong thả cho tuổi hưu' },
      { day: 'Thứ 4', name: 'Yoga cùng Tạ (Dumbbell Yoga)', teacher: 'M. Govinda', seniorFriendly: false },
      { day: 'Thứ 5', name: 'Chuỗi Truyền Thống (Hatha)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Nhẹ nhàng, dễ theo' },
      { day: 'Thứ 6', name: 'Yoga cùng Tường (Wall Yoga)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Có tường nâng đỡ, an toàn khớp' },
    ],
  },
  {
    time: '16:00 – 17:00',
    period: 'afternoon',
    periodLabel: 'Buổi chiều',
    sessions: [
      { day: 'Thứ 2', name: 'Chuỗi Truyền Thống (Hatha)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Chậm rãi, dễ tiếp cận' },
      { day: 'Thứ 4', name: 'Mở Lưng (Back Bend)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Cải thiện cột sống' },
      { day: 'Thứ 5', name: 'Chuỗi Năng Lượng (Power)', teacher: 'M. Gauri', seniorFriendly: false },
      { day: 'Thứ 6', name: 'Yoga cùng Tường (Wall Yoga)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Hỗ trợ giữ thăng bằng' },
      { day: 'Chủ Nhật', name: 'Lớp Chuyên Sâu 90 Phút', teacher: 'M. Govinda', seniorFriendly: true, note: 'Mở Hông & Vai · 15:00' },
    ],
  },
  {
    time: '17:30 – 18:30',
    period: 'afternoon',
    periodLabel: 'Chiều tối',
    sessions: [
      { day: 'Thứ 2', name: 'Chuỗi Năng Lượng (Power)', teacher: 'M. Govinda', seniorFriendly: false },
      { day: 'Thứ 4', name: 'Chuỗi Thăng Bằng (Balancing)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Rèn sự vững vàng' },
      { day: 'Thứ 5', name: 'Chuỗi Sức Mạnh (Ashtanga)', teacher: 'M. Govinda', seniorFriendly: false },
      { day: 'Thứ 6', name: 'Mở Vai & Nghiêng Lườn', teacher: 'M. Gauri', seniorFriendly: true, note: 'Giải tỏa mỏi lưng vai' },
      { day: 'Thứ 7', name: 'Chuỗi Truyền Thống (Hatha)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Nhẹ nhàng cuối tuần' },
      { day: 'Chủ Nhật', name: 'Tratak (Thiền Nến Thư Giãn)', teacher: 'M. Govinda & M. Gauri', seniorFriendly: true, note: 'Tĩnh tâm, dễ ngủ sâu' },
    ],
  },
  {
    time: '18:45 – 19:45',
    period: 'afternoon',
    periodLabel: 'Buổi tối',
    sessions: [
      { day: 'Thứ 2', name: 'Giãn Toàn Thân (Stretching)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Thả lỏng cơ trước khi ngủ' },
      { day: 'Thứ 4', name: 'Chuỗi Truyền Thống (Hatha)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Dịu nhẹ, thư thái' },
      { day: 'Thứ 5', name: 'Yoga cùng Gậy (Stick Yoga)', teacher: 'M. Govinda', seniorFriendly: true, note: 'Mở vai an toàn với gậy gỗ' },
      { day: 'Thứ 6', name: 'Yoga cùng Tường (Wall Yoga)', teacher: 'M. Gauri', seniorFriendly: true, note: 'Êm ái, hỗ trợ định tuyến' },
    ],
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Phòng tập tiện nghi chất lượng cao, giáo viên hướng dẫn tận tình, nhiều kinh nghiệm.',
    author: 'Cô Xuân Mai Nguyễn',
    source: 'Đánh giá trên Facebook Power Yoga Đồng Nai',
    date: '100% Đề xuất',
  },
  {
    quote:
      'Rất chuyên nghiệp, hiện đại, thân thiện và sạch đẹp. Đến tập mỗi ngày thấy tinh thần vô cùng thoải mái.',
    author: 'Chú Phan Văn Cầm',
    source: 'Đánh giá trên Facebook Power Yoga Đồng Nai',
    date: '100% Đề xuất',
  },
  {
    quote:
      'Yoga là bí kíp kéo dài sức khỏe, vẻ đẹp thanh xuân và tuổi thọ — với mình, Yoga thực sự là một “phép màu” mỗi ngày.',
    author: 'Chị Loan Tóc',
    source: 'Học viên gắn bó tại Power Yoga Đồng Nai',
    date: '100% Đề xuất',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Tôi đã nghỉ hưu, người hơi cứng và chưa từng tập Yoga bao giờ thì có theo kịp không?',
    answer:
      'Hoàn toàn được ạ! Yoga không đòi hỏi cô chú phải dẻo sẵn mới tập được — chính việc tập đều đặn sẽ giúp cơ thể mềm mại dần lên. Tại Power Yoga Đồng Nai có các lớp Gentle Yoga (Nhẹ Nhàng), Hatha Truyền Thống, Wall Yoga và Stretching với đầy đủ gạch, dây, gậy hỗ trợ để cô chú tập theo đúng sức của mình.',
  },
  {
    question: 'Bị thoái hóa khớp gối hoặc đau thắt lưng mạn tính có tập Yoga được không?',
    answer:
      'Rất phù hợp khi được hướng dẫn đúng cách. Giáo viên Ấn Độ sẽ tư vấn và điều chỉnh biên độ động tác riêng cho cô chú (ví dụ dùng ghế, gạch kê hoặc đệm hỗ trợ đầu gối, tránh gập quá sâu) giúp giảm áp lực khớp, tăng sức mạnh cơ nâng đỡ và giảm đau mỏi rõ rệt qua từng tuần.',
  },
  {
    question: 'Giáo viên là người Ấn Độ thì tôi có nghe hiểu được hướng dẫn không?',
    answer:
      'Cô chú hoàn toàn yên tâm! Power Yoga Đồng Nai luôn bố trí đội ngũ phiên dịch tiếng Việt đồng hành trực tiếp trong các lớp học, đồng thời giáo viên luôn làm mẫu chậm rãi và đến tận thảm chỉnh nhẹ tư thế cho từng học viên.',
  },
  {
    question: 'Đến tập có cần tự mua thảm hay mang theo dụng cụ gì không?',
    answer:
      'Không cần đâu ạ. Phòng tập 800m² đã trang bị sẵn toàn bộ thảm tập, vòng, gạch, gậy gỗ, bóng và võng được vệ sinh sạch sẽ mỗi ngày, kèm tủ đồ cá nhân tiện lợi. Cô chú chỉ cần mặc trang phục co giãn thoải mái và mang theo chai nước cá nhân.',
  },
  {
    question: 'Tôi muốn đến tham quan phòng tập và tập thử trước khi đăng ký được không?',
    answer:
      'Rất hoan nghênh cô chú! Power Yoga Đồng Nai hiện dành tặng 03 buổi tập thử hoàn toàn miễn phí cho học viên mới tại Biên Hòa – Đồng Nai để cô chú trực tiếp trải nghiệm không gian, phòng xông hơi đá Mosaic, giường đá muối Himalaya và cảm nhận cách dạy của các Master trước khi quyết định. Chỉ cần gọi 0847 684 539 hoặc nhắn Zalo để giữ chỗ.',
  },
  {
    question: 'Phòng tập nằm ở đâu tại Biên Hòa và có dễ tìm đường không?',
    answer:
      'Phòng tập tọa lạc tại số 71/81A Quốc Lộ 51, Khu Phố 5, Phường Long Hưng, Đồng Nai (địa chỉ cũ: KP1, Phường Long Bình Tân, TP. Biên Hòa — ngay sau lưng siêu thị Big C Đồng Nai / GO! Đồng Nai), đường rộng dễ đi và rất thuận tiện di chuyển từ các phường trung tâm Biên Hòa.',
  },
];
