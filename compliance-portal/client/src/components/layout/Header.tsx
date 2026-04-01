import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const routeMeta: Record<string, { title: string; subtitle?: string; breadcrumbs: { label: string; to?: string }[] }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Overview of your compliance campaigns',
    breadcrumbs: [{ label: 'Dashboard' }],
  },
  '/campaigns': {
    title: 'Campaigns',
    subtitle: 'Manage your WCAG compliance campaigns',
    breadcrumbs: [{ label: 'Campaigns' }],
  },
  '/campaigns/new': {
    title: 'New Campaign',
    subtitle: 'Configure a new WCAG compliance campaign',
    breadcrumbs: [{ label: 'Campaigns', to: '/campaigns' }, { label: 'New Campaign' }],
  },
  '/reports': {
    title: 'Reports',
    subtitle: 'Generate and download compliance reports',
    breadcrumbs: [{ label: 'Reports' }],
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage WCAG rules, imports, and application configuration',
    breadcrumbs: [{ label: 'Settings' }],
  },
};

function resolveRoute(pathname: string) {
  if (routeMeta[pathname]) return routeMeta[pathname];

  // Handle /campaigns/:id
  const campaignMatch = /^\/campaigns\/([^/]+)$/.exec(pathname);
  if (campaignMatch) {
    return {
      title: 'Campaign Details',
      subtitle: undefined,
      breadcrumbs: [
        { label: 'Campaigns', to: '/campaigns' },
        { label: 'Campaign Details' },
      ],
    };
  }

  return { title: 'Page', subtitle: undefined, breadcrumbs: [{ label: 'Page' }] };
}

// Pages that render their own primary action button — don't show one in the header
const PAGES_WITH_OWN_ACTION = new Set(['/', '/campaigns', '/reports', '/settings']);

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, subtitle, breadcrumbs } = resolveRoute(location.pathname);

  const isCampaignDetail = /^\/campaigns\/[^/]+$/.test(location.pathname);
  const showNewCampaignBtn =
    !PAGES_WITH_OWN_ACTION.has(location.pathname) && !isCampaignDetail;

  return (
    <header className="flex shrink-0 items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex flex-col justify-center">
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {showNewCampaignBtn && (
        <Button size="sm" onClick={() => navigate('/campaigns/new')}>
          <Plus className="h-4 w-4 mr-1" />
          New Campaign
        </Button>
      )}
    </header>
  );
}
