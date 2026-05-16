type MotionThumbnailProps = {
  label: string;
};

export function MotionThumbnail({ label }: MotionThumbnailProps): JSX.Element {
  return (
    <div className="motion-thumbnail-shell">
      <div className="motion-thumbnail-node">
        <span>{label}</span>
      </div>
    </div>
  );
}
