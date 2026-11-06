/**
 * Tên hiển thị của trường phái, mục bói và tay xem. `shared` giữ bản tiếng Việt cho prompt AI,
 * nên app tra các nhãn này theo key. Thứ tự cột theo SCREEN_LANGUAGES.
 */
type Row = readonly [string, string, string, string, string, string, string, string, string];

export const READING_STRINGS: Record<string, Row> = {
  'school.WESTERN.name': ['Western palmistry', 'Chỉ tay phương Tây', 'Kiromansi Barat', 'पश्चिमी हस्तरेखा', '西方手相', 'Западная хиромантия', '西洋手相', 'Quiromancia ocidental', 'Quiromancia occidental'],
  'school.EASTERN.name': ['Eastern palmistry', 'Chỉ tay phương Đông', 'Kiromansi Timur', 'पूर्वी हस्तरेखा', '东方手相', 'Восточная хиромантия', '東洋手相', 'Quiromancia oriental', 'Quiromancia oriental'],
  'school.VEDIC.name': ['Indian palmistry', 'Chỉ tay Ấn Độ', 'Kiromansi India', 'भारतीय हस्तरेखा', '印度手相', 'Индийская хиромантия', 'インド手相', 'Quiromancia indiana', 'Quiromancia india'],
  'school.WESTERN.description': ['Four-element hand shapes, major lines and the 7 mounts', 'Dáng tay 4 nguyên tố, các đường chỉ chính và 7 gò', 'Bentuk tangan 4 elemen, garis utama, dan 7 bukit', 'चार तत्वों के हाथ के आकार, मुख्य रेखाएँ और 7 पर्वत', '四元素手型、主要掌纹和七丘', 'Формы руки по 4 стихиям, главные линии и 7 холмов', '4元素の手の形、主要な線、7つの丘', 'Formatos de mão dos 4 elementos, linhas principais e 7 montes', 'Formas de mano de los 4 elementos, líneas principales y 7 montes'],
  'school.EASTERN.description': ['Five-element hand shapes, Heaven–Human–Earth lines and the eight trigrams', 'Dáng tay ngũ hành, Thiên – Nhân – Địa văn, cung bát quái', 'Bentuk tangan lima unsur, garis Langit–Manusia–Bumi, dan delapan trigram', 'पंचतत्व हाथ के आकार, स्वर्ग–मानव–पृथ्वी रेखाएँ और आठ त्रिग्राम', '五行手型、天人地三纹、八卦宫位', 'Формы руки по 5 стихиям, линии Неба, Человека и Земли, восемь триграмм', '五行の手の形、天・人・地の紋、八卦宮', 'Formatos de mão dos cinco elementos, linhas Céu–Homem–Terra e oito trigramas', 'Formas de mano de los cinco elementos, líneas Cielo–Hombre–Tierra y ocho trigramas'],
  'school.VEDIC.description': ['Mounts of the 9 planets, major lines and special signs', 'Gò theo 9 hành tinh, đường chính, dấu hiệu đặc biệt', 'Bukit 9 planet, garis utama, dan tanda khusus', '9 ग्रहों के पर्वत, मुख्य रेखाएँ और विशेष चिह्न', '九大行星丘、主要掌纹、特殊标记', 'Холмы 9 планет, главные линии и особые знаки', '9惑星の丘、主要な線、特別なしるし', 'Montes dos 9 planetas, linhas principais e sinais especiais', 'Montes de los 9 planetas, líneas principales y signos especiales'],
  'school.WESTERN.short': ['WEST', 'TÂY', 'BARAT', 'पश्चिम', '西方', 'ЗАПАД', '西洋', 'OESTE', 'OESTE'],
  'school.EASTERN.short': ['EAST', 'ĐÔNG', 'TIMUR', 'पूर्व', '东方', 'ВОСТОК', '東洋', 'LESTE', 'ESTE'],
  'school.VEDIC.short': ['INDIA', 'ẤN', 'INDIA', 'भारत', '印度', 'ИНДИЯ', 'インド', 'ÍNDIA', 'INDIA'],
  'school.EASTERN.handHint': ['Men read the left hand, women the right', 'Nam xem tay trái, nữ xem tay phải', 'Pria membaca tangan kiri, wanita tangan kanan', 'पुरुष बायाँ हाथ, महिलाएँ दायाँ हाथ दिखाएँ', '男看左手，女看右手', 'Мужчинам — левая рука, женщинам — правая', '男性は左手、女性は右手', 'Homens leem a mão esquerda, mulheres a direita', 'Los hombres leen la mano izquierda y las mujeres la derecha'],

  'hand.left': ['Left hand', 'Tay trái', 'Tangan kiri', 'बायाँ हाथ', '左手', 'Левая рука', '左手', 'Mão esquerda', 'Mano izquierda'],
  'hand.right': ['Right hand', 'Tay phải', 'Tangan kanan', 'दायाँ हाथ', '右手', 'Правая рука', '右手', 'Mão direita', 'Mano derecha'],
  'hand.selected': ['SELECTED', 'ĐÃ CHỌN', 'DIPILIH', 'चुना गया', '已选择', 'ВЫБРАНО', '選択中', 'SELECIONADA', 'SELECCIONADA'],
  'hand.tapToSelect': ['TAP TO SELECT', 'CHẠM ĐỂ CHỌN', 'KETUK UNTUK MEMILIH', 'चुनने के लिए टैप करें', '点按选择', 'НАЖМИТЕ, ЧТОБЫ ВЫБРАТЬ', 'タップして選択', 'TOQUE PARA SELECIONAR', 'TOCA PARA SELECCIONAR'],

  'topics.all': ['All topics', 'Toàn bộ', 'Semua topik', 'सभी विषय', '全部项目', 'Все разделы', 'すべての項目', 'Todos os tópicos', 'Todos los temas'],
  'topics.count': ['{count} topics', '{count} mục', '{count} topik', '{count} विषय', '{count} 项', 'Разделов: {count}', '{count} 項目', '{count} tópicos', '{count} temas'],

  'topic.handShape': ['Four-element hand shape', 'Dáng tay 4 nguyên tố', 'Bentuk tangan 4 elemen', 'चार तत्वों का हाथ का आकार', '四元素手型', 'Форма руки по 4 стихиям', '4元素の手の形', 'Formato de mão dos 4 elementos', 'Forma de mano de los 4 elementos'],
  'topic.heartLine': ['Heart line', 'Đường tình cảm', 'Garis hati', 'हृदय रेखा', '感情线', 'Линия сердца', '感情線', 'Linha do coração', 'Línea del corazón'],
  'topic.headLine': ['Head line', 'Đường trí tuệ', 'Garis kepala', 'मस्तिष्क रेखा', '智慧线', 'Линия ума', '知能線', 'Linha da cabeça', 'Línea de la cabeza'],
  'topic.lifeLine': ['Life line', 'Đường sinh mệnh', 'Garis hidup', 'जीवन रेखा', '生命线', 'Линия жизни', '生命線', 'Linha da vida', 'Línea de la vida'],
  'topic.fateLine': ['Fate line', 'Đường định mệnh', 'Garis takdir', 'भाग्य रेखा', '命运线', 'Линия судьбы', '運命線', 'Linha do destino', 'Línea del destino'],
  'topic.sunLine': ['Sun line', 'Đường danh vọng', 'Garis matahari', 'सूर्य रेखा', '太阳线', 'Линия солнца', '太陽線', 'Linha do sol', 'Línea del sol'],
  'topic.mounts': ['7 mounts', '7 gò', '7 bukit', '7 पर्वत', '七丘', '7 холмов', '7つの丘', '7 montes', '7 montes'],
  'topic.nguHanh': ['Five-element hand shape', 'Dáng tay ngũ hành', 'Bentuk tangan lima unsur', 'पंचतत्व हाथ का आकार', '五行手型', 'Форма руки по 5 стихиям', '五行の手の形', 'Formato de mão dos cinco elementos', 'Forma de mano de los cinco elementos'],
  'topic.thienVan': ['Heaven line', 'Thiên văn', 'Garis Langit', 'स्वर्ग रेखा', '天纹', 'Линия Неба', '天紋', 'Linha do Céu', 'Línea del Cielo'],
  'topic.nhanVan': ['Human line', 'Nhân văn', 'Garis Manusia', 'मानव रेखा', '人纹', 'Линия Человека', '人紋', 'Linha do Homem', 'Línea del Hombre'],
  'topic.diaVan': ['Earth line', 'Địa văn', 'Garis Bumi', 'पृथ्वी रेखा', '地纹', 'Линия Земли', '地紋', 'Linha da Terra', 'Línea de la Tierra'],
  'topic.batQuai': ['Eight trigram palaces', 'Cung bát quái', 'Delapan istana trigram', 'आठ त्रिग्राम भवन', '八卦宫', 'Восемь дворцов триграмм', '八卦宮', 'Oito palácios dos trigramas', 'Ocho palacios de los trigramas'],
  'topic.fingers': ['Fingers', 'Các ngón tay', 'Jari-jari', 'उँगलियाँ', '手指', 'Пальцы', '指', 'Dedos', 'Dedos'],
  'topic.planetMounts': ['Mounts of the 9 planets', 'Gò theo 9 hành tinh', 'Bukit 9 planet', '9 ग्रहों के पर्वत', '九大行星丘', 'Холмы 9 планет', '9惑星の丘', 'Montes dos 9 planetas', 'Montes de los 9 planetas'],
  'topic.majorLines': ['Major lines', 'Các đường chính', 'Garis utama', 'मुख्य रेखाएँ', '主要掌纹', 'Главные линии', '主要な線', 'Linhas principais', 'Líneas principales'],
  'topic.specialSigns': ['Special signs', 'Dấu hiệu đặc biệt', 'Tanda khusus', 'विशेष चिह्न', '特殊标记', 'Особые знаки', '特別なしるし', 'Sinais especiais', 'Signos especiales'],
  'topic.thumb': ['Thumb', 'Ngón cái', 'Ibu jari', 'अंगूठा', '拇指', 'Большой палец', '親指', 'Polegar', 'Pulgar'],

  'topic.personality': ['Personality', 'Tính cách', 'Kepribadian', 'व्यक्तित्व', '性格', 'Характер', '性格', 'Personalidade', 'Personalidad'],
  'topic.love': ['Love', 'Tình cảm', 'Cinta', 'प्रेम', '感情', 'Любовь', '恋愛', 'Amor', 'Amor'],
  'topic.career': ['Career', 'Sự nghiệp', 'Karier', 'करियर', '事业', 'Карьера', '仕事', 'Carreira', 'Carrera'],
  'topic.finance': ['Finance', 'Tài chính', 'Keuangan', 'वित्त', '财务', 'Финансы', '金運', 'Finanças', 'Finanzas'],
  'topic.health': ['Health', 'Sức khoẻ', 'Kesehatan', 'स्वास्थ्य', '健康', 'Здоровье', '健康', 'Saúde', 'Salud'],
  'topic.family': ['Family', 'Gia đạo', 'Keluarga', 'परिवार', '家庭', 'Семья', '家庭', 'Família', 'Familia'],
};
