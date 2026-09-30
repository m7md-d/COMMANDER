import type { DossierReview } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";

/**
 * The code reviews of this member's pushes: the officer's verdict on each push's
 * diff, newest first (0009 §7). The verdict is a labelled badge — the word
 * carries the state, colour only reinforces it — followed by the model's remark
 * and any concrete findings. Empty while the review is off.
 */
export function DossierReviews({ reviews }: { reviews: DossierReview[] }) {
  const t = useTranslate();

  return (
    <Card title={t("dossier.reviews")}>
      {reviews.length === 0 ? (
        <EmptyState message={t("dossier.reviewsEmpty")} />
      ) : (
        <ul className="reviews">
          {reviews.map((review) => (
            <li key={review.head} className="review">
              <div className="review-head">
                <span className={`verdict verdict-${review.verdict}`}>
                  {t(`review.verdict.${review.verdict}`)}
                </span>
                <span className="review-title">{review.title}</span>
              </div>
              {review.remark && <p className="review-remark">{review.remark}</p>}
              {review.findings.length > 0 && (
                <ul className="review-findings">
                  {review.findings.map((finding, index) => (
                    <li key={index}>{finding}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
