export type ExtraPhone = { phone: string; name?: string };

export function digitsKey(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export function partnerPhone(partner: any): string {
  return String(partner?.whatsapp_number || partner?.phone || '').trim();
}

export function isConsultantAudience(filters: any): boolean {
  return filters?.audience === 'consultants' || filters?.type === 'consultant';
}

export function partnerMatchesConsultantFilters(partner: any, filters: any): boolean {
  const statuses: string[] = filters?.partner_statuses || [];
  if (statuses.length > 0 && !statuses.includes('all')) {
    if (!statuses.includes(partner.status || 'pending')) return false;
  }
  const tiers: string[] = filters?.partner_tiers || [];
  if (tiers.length > 0 && !tiers.includes('all')) {
    const level = partner.partner_level || partner.partnerLevel;
    if (level && !tiers.includes(level)) return false;
  }
  return true;
}

export function buildConsultantTargets(
  partners: any[],
  partnerUsers: any[],
  filters: any = {}
): any[] {
  const includeAll = filters.include_all !== false;
  const partnerIds: string[] = Array.isArray(filters.partner_ids) ? filters.partner_ids : [];
  const extraPhones: ExtraPhone[] = Array.isArray(filters.extra_phones) ? filters.extra_phones : [];
  const includeStaff = !!filters.include_staff;

  let selected = (partners || []).filter((p) => partnerMatchesConsultantFilters(p, filters));

  if (!includeAll) {
    const idSet = new Set(partnerIds);
    selected = selected.filter((p) => idSet.has(p.id));
  } else if (partnerIds.length > 0) {
    const idSet = new Set(partnerIds);
    const extras = (partners || []).filter((p) => idSet.has(p.id) && !selected.some((s) => s.id === p.id));
    selected = [...selected, ...extras];
  }

  const seen = new Set<string>();
  const targets: any[] = [];

  const push = (row: any) => {
    const phone = String(row.phone || row.whatsapp_number || '').trim();
    if (!phone) return;
    const key = digitsKey(phone);
    if (key.length < 8) return;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({
      ...row,
      phone,
      whatsapp_number: phone,
      name: row.name || row.primary_contact_name || row.business_name || phone,
      audience: 'consultants',
    });
  };

  for (const partner of selected) {
    push({
      id: partner.id,
      name: partner.primary_contact_name || partner.business_name,
      primary_contact_name: partner.primary_contact_name,
      business_name: partner.business_name,
      email: partner.email,
      phone: partnerPhone(partner),
      partner_level: partner.partner_level,
      status: partner.status,
    });

    if (includeStaff) {
      for (const user of partnerUsers || []) {
        if (user.partner_id !== partner.id || !user.phone) continue;
        if (['super_admin', 'admin', 'partner_manager', 'analyst'].includes(user.role)) continue;
        push({
          id: user.id,
          name: user.full_name,
          primary_contact_name: user.full_name,
          business_name: partner.business_name,
          email: user.email,
          phone: user.phone,
          partner_level: partner.partner_level,
          status: partner.status,
        });
      }
    }
  }

  for (const extra of extraPhones) {
    const phone = String(extra.phone || '').trim();
    if (!phone) continue;
    push({
      id: `extra-${digitsKey(phone)}`,
      name: extra.name || phone,
      primary_contact_name: extra.name || phone,
      business_name: extra.name || 'Extra contact',
      email: '',
      phone,
      partner_level: '',
      status: 'active',
    });
  }

  return targets;
}

export function parseExtraPhones(input: string, defaultName = ''): ExtraPhone[] {
  return input
    .split(/[\n,;]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const named = chunk.match(/^(.*?)\s*[<(]\s*([+0-9][0-9\s-]{7,})\s*[>)]$/);
      if (named) {
        return {
          name: named[1].replace(/^["']|["']$/g, '').trim() || defaultName,
          phone: named[2].trim(),
        };
      }
      return { name: defaultName, phone: chunk };
    })
    .filter((item) => digitsKey(item.phone).length >= 8);
}
