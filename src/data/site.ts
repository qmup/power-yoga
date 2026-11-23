export const SITE = {
  // Đổi tên miền chính thức tại đây khi có domain riêng (ví dụ: https://poweryogadongnai.vn)
  url: 'https://power-yoga.vercel.app',
  name: 'Power Yoga Đồng Nai',
  shortName: 'Power Yoga',
  tagline: 'Power for You, Power for ALL.',
  motto: 'Power Yoga — nơi trở về với hơi thở, sự bình an và tinh thần yoga nguyên bản.',
  locale: 'vi_VN',
  language: 'vi',

  seo: {
    title: 'Power Yoga Đồng Nai | Phòng Tập Yoga Cho Người Lớn Tuổi & Trị Liệu Tại Biên Hòa',
    description:
      'Power Yoga Đồng Nai — Phòng tập yoga 800m² chuẩn quốc tế tại Biên Hòa (ngay sau Big C Đồng Nai). Giáo viên Ấn Độ có phiên dịch tiếng Việt, yoga nhẹ nhàng & trị liệu khớp gối, đau lưng, ngủ ngon cho người đã nghỉ hưu. Tặng 03 buổi tập thử miễn phí. Hotline/Zalo: 0847 684 539.',
    keywords: [
      'Power Yoga Đồng Nai',
      'phòng tập yoga Biên Hòa',
      'yoga Biên Hòa',
      'yoga Đồng Nai',
      'yoga cho người lớn tuổi Biên Hòa',
      'yoga cho người nghỉ hưu Biên Hòa',
      'yoga người cao tuổi Đồng Nai',
      'yoga trị liệu khớp gối Biên Hòa',
      'yoga trị liệu đau lưng Biên Hòa',
      'yoga giáo viên Ấn Độ Biên Hòa',
      'phòng tập yoga Long Bình Tân',
      'phòng tập yoga Long Hưng',
      'yoga gần Big C Đồng Nai',
      'Hatha yoga Biên Hòa',
    ],
    ogImage: '/images/community-landscape.jpg',
  },

  contact: {
    phoneRaw: '0847684539',
    phoneDisplay: '0847 684 539',
    phoneIntl: '+84847684539',
    telHref: 'tel:0847684539',
    zaloHref: 'https://zalo.me/0847684539',
    messengerHref: 'https://m.me/poweryogadongnai',
    email: 'poweryogabienhoa@gmail.com',
    facebookUrl: 'https://www.facebook.com/poweryogadongnai',
    googleMapsUrl: 'https://maps.app.goo.gl/gj6RdLzJYh3Q4gbU6',
    googleMapsEmbedUrl:
      'https://maps.google.com/maps?q=71%2F81A%20Qu%E1%BB%91c%20L%E1%BB%99%2051%2C%20Long%20B%C3%ACnh%20T%C3%A2n%2C%20Bi%C3%AAn%20H%C3%B2a%2C%20%C4%90%E1%BB%93ng%20Nai&t=&z=16&ie=UTF8&iwloc=&output=embed',
    consultFormUrl: 'https://forms.gle/4a3zKR9hXtJLAdvq9',
  },

  address: {
    current: '71/81A, Quốc Lộ 51, Khu Phố 5, Phường Long Hưng, Tỉnh Đồng Nai',
    legacy: '71/81A, Quốc Lộ 51, Khu Phố 1, Phường Long Bình Tân, TP. Biên Hòa, Đồng Nai',
    landmark: 'Ngay sau lưng Big C Đồng Nai (GO! Đồng Nai)',
    shortLocation: 'Quốc Lộ 51, Biên Hòa – Đồng Nai',
    streetAddress: '71/81A Quốc Lộ 51, KP5, P. Long Hưng (P. Long Bình Tân cũ)',
    addressLocality: 'Biên Hòa',
    addressRegion: 'Đồng Nai',
    postalCode: '76000',
    addressCountry: 'VN',
    geo: {
      latitude: 10.9032,
      longitude: 106.8489,
    },
  },

  hours: {
    summary: 'Thứ 2 – Chủ Nhật · 05:00 – 20:00',
    classesSummary: 'Các ca tập linh hoạt từ 05:00 đến 19:45 mỗi ngày',
    opens: '05:00',
    closes: '20:00',
  },

  stats: [
    { value: '800m²', label: 'Không gian chuẩn quốc tế' },
    { value: '100%', label: 'Giáo viên Ấn Độ + Phiên dịch' },
    { value: '03 buổi', label: 'Tập thử miễn phí cho người mới' },
    { value: '2020', label: 'Đồng hành cùng học viên Biên Hòa' },
  ],
} as const;
