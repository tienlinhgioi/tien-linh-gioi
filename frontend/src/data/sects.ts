export const elements = [
  {
    id: "kim",
    name: "Kim",
    description: "Sắc bén và kiên định; ý chí tựa mũi kiếm trong mây.",
    color: "#af9867",
    glyph: "金",
  },
  {
    id: "moc",
    name: "Mộc",
    description: "Sinh khí tuần hoàn, cùng cây cỏ nuôi dưỡng đạo tâm.",
    color: "#66866b",
    glyph: "木",
  },
  {
    id: "thuy",
    name: "Thủy",
    description: "Tĩnh như mặt hồ, mềm mại mà bền bỉ.",
    color: "#688f99",
    glyph: "水",
  },
  {
    id: "hoa",
    name: "Hỏa",
    description: "Lửa ấm luyện tâm, vượt nghịch cảnh để trưởng thành.",
    color: "#b07e68",
    glyph: "火",
  },
  {
    id: "tho",
    name: "Thổ",
    description: "Vững như núi, bao dung và gìn giữ nền tảng.",
    color: "#9d8b66",
    glyph: "土",
  },
] as const;
export type ElementId = (typeof elements)[number]["id"];
export const sects = [
  {
    element: "kim",
    name: "Huyền Kim Điện",
    description: "Luyện kiếm trong mây, lấy sắc bén làm đạo.",
  },
  {
    element: "moc",
    name: "Thanh Vân Môn",
    description: "Tu cùng cây cỏ, lấy sinh khí nuôi thân.",
  },
  {
    element: "thuy",
    name: "Hàn Nguyệt Cung",
    description: "Tĩnh như mặt hồ, mượn sóng trăng dưỡng thần.",
  },
  {
    element: "hoa",
    name: "Xích Diễm Các",
    description: "Luyện đan trong lửa, đốt kiếp mà thành.",
  },
  {
    element: "tho",
    name: "Hậu Thổ Sơn Trang",
    description: "Vững như núi, lấy đất làm nền cho đạo tâm.",
  },
] as const;
export const realms = [
  "Luyện Khí",
  "Trúc Cơ",
  "Nguyên Anh",
  "Hóa Thần",
  "Luyện Hư",
  "Hợp Thể",
  "Động Hư",
  "Độ Kiếp",
  "Đại Thừa",
  "Bán Tiên",
  "Chân Tiên",
];
export type CharacterProfile = {
  name: string;
  element: ElementId;
  sect: string;
  avatar: number;
};
export function validateCharacterName(name: string) {
  return name.trim().length >= 2 && name.trim().length <= 20;
}
