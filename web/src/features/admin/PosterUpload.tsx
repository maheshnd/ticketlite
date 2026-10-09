"use client";
// Poster upload: choose a file, it goes straight to S3 (presigned POST), then poster-processor validates it
// and attaches it to the event a few seconds later (asynchronously). CONCEPT: presigned-urls
import { POSTER_MAX_BYTES } from "@ticketlite/shared";
import { useState } from "react";
import { FormAlert } from "../../components/FormAlert";
import { useUploadPoster } from "./admin-queries";

export function PosterUpload({ eventId }: { eventId: string }) {
  const upload = useUploadPoster();
  const [tooBig, setTooBig] = useState(false);

  function onFile(file: File | undefined) {
    if (!file) return;
    // A friendly early check. S3 enforces the same limit through the signed policy.
    setTooBig(file.size > POSTER_MAX_BYTES);
    if (file.size <= POSTER_MAX_BYTES) upload.mutate({ eventId, file });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="poster" className="font-medium">
        Poster (JPEG, PNG or WebP, max 2 MB)
      </label>
      <input
        id="poster"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <FormAlert message={tooBig ? "That file is larger than 2 MB." : (upload.error?.message ?? null)} />
      <p aria-live="polite">
        {upload.isPending && "Uploading…"}
        {upload.isSuccess && "Uploaded. It will appear on the event page in a few seconds."}
      </p>
    </div>
  );
}
