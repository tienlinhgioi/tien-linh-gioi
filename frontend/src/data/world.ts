export function validateIdentity(
  name: string,
  password: string,
  confirm: string | undefined,
): string {
  if (name.trim().length < 2) return "Đạo danh cần có ít nhất 2 ký tự.";
  if (password.length < 6) return "Mật khẩu cần có ít nhất 6 ký tự.";
  if (confirm !== undefined && password !== confirm)
    return "Hai mật khẩu chưa trùng khớp.";
  return "";
}
