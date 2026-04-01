/**
 * Audit category definitions for the Compliance Portal.
 *
 * The 'accessibility' category is populated dynamically from WCAG guidelines data
 * at runtime.
 */

export interface AuditCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  checks: AuditCheck[];
}

export interface AuditCheck {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export const auditCategories: AuditCategory[] = [
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'WCAG 2.1 compliance testing using axe-core',
    icon: 'accessibility',
    checks: [], // Populated from WCAG guidelines dynamically
  },
];
