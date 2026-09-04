import type { Metadata } from "next";
import Link from "next/link";
import { Company, Founder } from "@/lib/types";
import { getCompanyData } from "@/lib/data";
import { batchChipClasses, displayUrl, formatDate, plural } from "@/lib/format";
import { FounderAvatar } from "@/components/FounderChip";
import { JobSourceBadge } from "@/components/JobBadge";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  LinkedInIcon,
  PinIcon,
  StarIcon,
  TrendingUpIcon,
  UsersIcon,
} from "@/components/Icons";

export async function generateStaticParams() {
  const { companies } = await getCompanyData();
  return (companies ?? []).map((c) => ({
    slug: c.slug,
  }));
}

async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const { companies } = await getCompanyData();
  return (companies ?? []).find((c) => c?.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: company.name,
    description: company.description ?? undefined,
  };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center mb-5 text-faint text-xl font-semibold">
            ?
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Company not found</h1>
          <p className="text-subtle mb-6 text-sm">
            No company with slug &ldquo;{slug}&rdquo; exists in the dataset.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-white/[0.05] border border-border text-foreground hover:border-border-strong"
          >
            <ArrowLeftIcon size={14} />
            Back to companies
          </Link>
        </div>
      </div>
    );
  }

  const founders = company.founders ?? [];
  const industries = company.industries ?? [];
  const tags = company.tags ?? [];
  const regions = company.regions ?? [];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            id="back-link"
            className="inline-flex items-center gap-2 text-[13px] text-subtle hover:text-foreground"
          >
            <ArrowLeftIcon size={15} />
            Back to companies
          </Link>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              id="company-website-link"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-muted bg-white/[0.04] border border-border hover:text-foreground hover:border-border-strong"
            >
              {displayUrl(company.website)}
              <ExternalLinkIcon size={12} className="text-faint" />
            </a>
          )}
        </div>
      </nav>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="animate-in">
          <HeroSection company={company} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 items-start">
          {/* Primary column */}
          <div className="min-w-0 space-y-10">
            {company.long_description && (
              <div className="animate-in delay-100">
                <Section title="About">
                  <p className="text-[14px] text-muted leading-[1.75] whitespace-pre-line">
                    {company.long_description}
                  </p>
                </Section>
              </div>
            )}

            {founders.length > 0 && (
              <div className="animate-in delay-200">
                <FoundersSection founders={founders} />
              </div>
            )}
          </div>

          {/* Side column */}
          <aside className="space-y-6 lg:sticky lg:top-20">
            <div className="animate-in delay-100">
              <JobsCard company={company} />
            </div>
            <div className="animate-in delay-300">
              <DetailsCard
                company={company}
                industries={industries}
                tags={tags}
                regions={regions}
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

const STATUS_CLASSES: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Public: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  Acquired: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  Inactive: "bg-white/[0.04] text-subtle border-border",
};

function HeroSection({ company }: { company: Company }) {
  const name = company.name ?? "Unknown Company";

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-surface border border-border ring-1 ring-white/[0.04] overflow-hidden flex items-center justify-center shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={`${name} logo`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain p-2.5"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600">
            {name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-2xl sm:text-[32px] font-semibold text-foreground tracking-tight leading-none">
            {name}
          </h1>
          {company.is_top_company && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
              <StarIcon size={10} />
              Top company
            </span>
          )}
        </div>

        {company.description && (
          <p className="text-[15px] text-muted leading-relaxed mb-4 max-w-2xl">{company.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {company.batch && <Chip className={batchChipClasses(company.batch)}>{company.batch}</Chip>}
          {company.status && (
            <Chip className={STATUS_CLASSES[company.status] ?? "bg-white/[0.04] text-subtle border-border"}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {company.status}
            </Chip>
          )}
          {company.stage && (
            <Chip className="bg-white/[0.04] text-muted border-border">
              <TrendingUpIcon size={12} className="text-faint" />
              {company.stage} stage
            </Chip>
          )}
          {company.team_size && (
            <Chip className="bg-white/[0.04] text-muted border-border">
              <UsersIcon size={12} className="text-faint" />
              {company.team_size.toLocaleString()} {plural(company.team_size, "person", "people")}
            </Chip>
          )}
          {company.location && (
            <Chip className="bg-white/[0.04] text-muted border-border">
              <PinIcon size={12} className="text-faint" />
              {company.location}
            </Chip>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium border ${className}`}
    >
      {children}
    </span>
  );
}

/* ─── Founders ────────────────────────────────────────────────────── */

function FoundersSection({ founders }: { founders: Founder[] }) {
  return (
    <Section title="Founders" count={founders.length}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {founders.map((founder, i) => (
          <div
            key={`${founder.name ?? "founder"}-${i}`}
            className="flex gap-3.5 p-4 bg-surface border border-border rounded-2xl hover:border-border-strong transition-colors duration-200"
          >
            <FounderAvatar founder={founder} size="lg" className="ring-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-foreground truncate">
                    {founder.name ?? "Founder"}
                  </p>
                  <p className={`text-[12px] truncate ${founder.college ? "text-subtle" : "text-faint"}`}>
                    {founder.college ?? "Background unknown"}
                  </p>
                </div>
                {founder.linkedin_url && (
                  <a
                    href={founder.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${founder.name ?? "Founder"} on LinkedIn`}
                    className="w-8 h-8 shrink-0 rounded-lg bg-white/[0.04] border border-border flex items-center justify-center text-subtle hover:text-[#4c9be8] hover:border-[#0a66c2]/40 hover:bg-[#0a66c2]/10"
                  >
                    <LinkedInIcon size={13} />
                  </a>
                )}
              </div>
              {founder.raw_bio && (
                <p className="mt-2 text-[12.5px] text-subtle leading-relaxed line-clamp-3">
                  {founder.raw_bio}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─── Jobs ────────────────────────────────────────────────────────── */

function JobsCard({ company }: { company: Company }) {
  const jb = company.job_board;
  const hasCount = jb?.count !== null && jb?.count !== undefined;
  const count = hasCount ? (jb!.count as number) : null;
  const careersUrl = company.website ? `${company.website.replace(/\/+$/, "")}/careers` : null;
  const primaryUrl = jb?.url ?? careersUrl;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface border border-border p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle mb-3">Open roles</p>

        {count !== null ? (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-foreground tracking-tight tabular-nums leading-none">
              {count}
            </span>
            <span className="text-[13px] text-subtle">{plural(count, "open role")}</span>
          </div>
        ) : (
          <p className="text-[14px] text-muted leading-snug">
            Marked as hiring by YC. Role count not published yet.
          </p>
        )}

        {jb && (
          <div className="mt-3">
            <JobSourceBadge jobBoard={jb} />
          </div>
        )}

        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="view-jobs-link"
            className="mt-5 flex items-center justify-center gap-2 h-10 w-full rounded-xl text-[13px] font-medium
              bg-accent text-white hover:bg-orange-500 shadow-[0_10px_30px_-10px_rgba(249,115,22,0.8)]"
          >
            {jb?.url ? "View all jobs" : "Visit careers page"}
            <ExternalLinkIcon size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Details ─────────────────────────────────────────────────────── */

function DetailsCard({
  company,
  industries,
  tags,
  regions,
}: {
  company: Company;
  industries: string[];
  tags: string[];
  regions: string[];
}) {
  const completeness = Math.round((company.data_completeness ?? 0) * 100);

  return (
    <div className="rounded-2xl bg-surface border border-border divide-y divide-border">
      {industries.length > 0 && (
        <DetailRow label="Industries">
          <ChipList items={industries} />
        </DetailRow>
      )}
      {tags.length > 0 && (
        <DetailRow label="Tags">
          <ChipList items={tags} muted />
        </DetailRow>
      )}
      {regions.length > 0 && (
        <DetailRow label="Regions">
          <p className="text-[13px] text-muted leading-relaxed">{regions.join(", ")}</p>
        </DetailRow>
      )}
      <DetailRow label="Source">
        <p className="text-[13px] text-muted">{company.source_vc ?? "Y Combinator"}</p>
      </DetailRow>
      <DetailRow label="Last updated">
        <p className="text-[13px] text-muted">{formatDate(company.last_scraped, "long")}</p>
      </DetailRow>
      <DetailRow label="Data completeness">
        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-[12px] font-medium text-muted tabular-nums">{completeness}%</span>
        </div>
      </DetailRow>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold text-faint uppercase tracking-[0.1em] mb-2">{label}</p>
      {children}
    </div>
  );
}

function ChipList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`px-2 py-0.5 rounded-md text-[11px] border border-border bg-white/[0.04] ${
            muted ? "text-subtle" : "text-muted"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────────────── */

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-[11px] font-semibold text-subtle uppercase tracking-[0.12em] mb-4">
        {title}
        {typeof count === "number" && (
          <span className="text-faint font-medium tabular-nums normal-case tracking-normal">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
