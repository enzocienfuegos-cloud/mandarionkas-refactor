const VALID_PIXEL_TYPES = ['impression', 'click', 'viewability', 'custom'];

function normalizePixelType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_PIXEL_TYPES.includes(normalized) ? normalized : null;
}

function trimText(value) {
  return String(value ?? '').trim();
}

export async function listTagPixels(pool, { workspaceId, tagId }) {
  const { rows } = await pool.query(
    `
      select p.id, p.tag_id, p.pixel_type, p.url, p.created_at
      from tag_pixels p
      join ad_tags t on t.id = p.tag_id
      where t.workspace_id = $1
        and p.tag_id = $2
      order by p.created_at asc
    `,
    [workspaceId, tagId],
  );
  return rows;
}

export async function createTagPixel(pool, { workspaceId, tagId, pixelType, url }) {
  const normalizedType = normalizePixelType(pixelType);
  const normalizedUrl = trimText(url);
  if (!normalizedType) throw new Error('Pixel type is invalid.');
  if (!normalizedUrl) throw new Error('Pixel URL is required.');

  const { rows } = await pool.query(
    `
      insert into tag_pixels (tag_id, pixel_type, url)
      select $2, $3, $4
      where exists (
        select 1
        from ad_tags t
        where t.id = $2
          and t.workspace_id = $1
      )
      returning id, tag_id, pixel_type, url, created_at
    `,
    [workspaceId, tagId, normalizedType, normalizedUrl],
  );

  return rows[0] ?? null;
}

export async function updateTagPixel(pool, { workspaceId, tagId, pixelId, pixelType, url }) {
  const normalizedType = pixelType === undefined ? undefined : normalizePixelType(pixelType);
  const normalizedUrl = url === undefined ? undefined : trimText(url);
  if (pixelType !== undefined && !normalizedType) throw new Error('Pixel type is invalid.');
  if (url !== undefined && !normalizedUrl) throw new Error('Pixel URL is required.');

  const fields = [];
  const params = [workspaceId, tagId, pixelId];
  if (normalizedType !== undefined) {
    params.push(normalizedType);
    fields.push(`pixel_type = $${params.length}`);
  }
  if (normalizedUrl !== undefined) {
    params.push(normalizedUrl);
    fields.push(`url = $${params.length}`);
  }
  if (!fields.length) throw new Error('No pixel changes were provided.');

  const { rows } = await pool.query(
    `
      update tag_pixels p
      set ${fields.join(', ')}
      from ad_tags t
      where p.id = $3
        and p.tag_id = $2
        and t.id = p.tag_id
        and t.workspace_id = $1
      returning p.id, p.tag_id, p.pixel_type, p.url, p.created_at
    `,
    params,
  );

  return rows[0] ?? null;
}

export async function deleteTagPixel(pool, { workspaceId, tagId, pixelId }) {
  const { rowCount } = await pool.query(
    `
      delete from tag_pixels p
      using ad_tags t
      where p.id = $3
        and p.tag_id = $2
        and t.id = p.tag_id
        and t.workspace_id = $1
    `,
    [workspaceId, tagId, pixelId],
  );
  return rowCount > 0;
}
