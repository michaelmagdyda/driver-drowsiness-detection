export function scorePassword(pw) {
  const hints = [];
  if (pw.length < 8) hints.push("At least 8 characters");
  if (!/[A-Z]/.test(pw)) hints.push("An uppercase letter");
  if (!/[a-z]/.test(pw)) hints.push("A lowercase letter");
  if (!/[0-9]/.test(pw)) hints.push("A number");
  if (!/[^A-Za-z0-9]/.test(pw)) hints.push("A symbol");
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) score++;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return {
    score: score,
    label: labels[score],
    hints,
  };
}
