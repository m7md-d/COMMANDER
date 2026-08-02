import { useNavigate } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";

/**
 * Go back one step in history.
 *
 * The chevron points toward the start of the reading order — left in English,
 * right in Arabic — using the project's `--flip` variable rather than a new
 * `[dir="rtl"]` rule, which the frontend constitution forbids (§3). Drawing it
 * this way is why "back" always points the intuitive direction without a
 * per-direction stylesheet.
 */
export function BackButton() {
  const t = useTranslate();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="back-btn"
      aria-label={t("action.back")}
      onClick={() => navigate(-1)}
    >
      <svg className="back-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M10 3 5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
