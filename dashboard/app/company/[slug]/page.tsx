import Link from "next/link";
import { Company, Founder } from "@/lib/types";
import FounderChip from "@/components/FounderChip";
import { JobSourceBadge } from "@/components/JobBadge";

async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/companies.json`, { 
    next: { revalidate: 3600 } 
  });
  const data = await res.json();
  const companies: Company[] = data.companies || data;
  return companies.find((c) => c.slug === slug);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#fafafa] mb-2">
            Company not found
          </h1>
          <p className="text-[#71717a] mb-6">
            No company with slug &ldquo;{slug}&rdquo; exists in the database.
          </p>
          <Link
            href="/"
            className="text-sm text-[#f97316] hover:text-[#fb923c] transition-colors"
          >
            ← Back to discovery feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-[#27272a] bg-[#09090b]">
        <div className="max-w-[900px] mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#71717a] hover:text-[#fafafa] transition-colors"
            id="back-link"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to companies
          </Link>
        </div>
      </nav>

      <main className="max-w-[900px] mx-auto px-6 py-10">
        {/* Hero */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <HeroSection company={company} />
        </div>

        {/* Founders */}
        {company.founders.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
            <FoundersSection founders={company.founders} />
          </div>
        )}

        {/* Jobs */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <JobsSection company={company} />
        </div>

        {/* Description */}
        {company.long_description && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
            <Section title="About">
              <p className="text-sm text-[#a1a1aa] leading-relaxed whitespace-pre-line">
                {company.long_description}
              </p>
            </Section>
          </div>
        )}

        {/* Details Grid */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          <DetailsSection company={company} />
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────── */

function HeroSection({ company }: { company: Company }) {
  const statusColors: Record<string, string> = {
    Active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Public: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    Acquired: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  };

  return (
    <div className="flex items-start gap-5 mb-10">
      <div className="w-16 h-16 rounded-2xl bg-[#18181b] border border-[#27272a] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <span className="text-2xl font-bold text-white w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
            {company.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
            {company.name}
          </h1>
          {company.batch && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
              {company.batch}
            </span>
          )}
          {company.status && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                statusColors[company.status] ||
                "bg-[#27272a] text-[#71717a] border-[#3f3f46]"
              }`}
            >
              {company.status}
            </span>
          )}
          {company.is_top_company && (
            <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-bold text-white rounded-full shadow-lg shadow-orange-500/20">
              ⭐ Top Company
            </span>
          )}
        </div>

        {company.description && (
          <p className="text-sm text-[#a1a1aa] mb-3">{company.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#71717a]">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f97316] transition-colors flex items-center gap-1"
              id="company-website-link"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {company.website.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          )}
          {company.location && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {company.location}
            </span>
          )}
          {company.stage && (
            <span className="flex items-center gap-1">
              📈 {company.stage}
            </span>
          )}
          {company.team_size && (
            <span className="flex items-center gap-1">
              👥 {company.team_size.toLocaleString()} team members
            </span>
          )}
        </div>

        {/* Data completeness bar */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] text-[#52525b] uppercase tracking-wider font-medium">
            Data completeness
          </span>
          <div className="flex-1 max-w-[200px] h-1.5 bg-[#27272a] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#f97316] to-[#22c55e]" style={{ width: `${company.data_completeness * 100}%` }} />
          </div>
          <span className="text-[11px] font-medium text-[#a1a1aa]">
            {Math.round(company.data_completeness * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function FoundersSection({ founders }: { founders: Founder[] }) {
  return (
    <Section title="Founders">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {founders.map((founder, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 bg-[#18181b] border border-[#27272a] rounded-xl hover:border-[#3f3f46] transition-colors"
          >
            <FounderChip founder={founder} size="md" />
            <div className="ml-auto flex-shrink-0">
              {founder.linkedin_url && (
                <a
                  href={founder.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#27272a] flex items-center justify-center text-[#71717a] hover:text-[#0a66c2] hover:bg-[#0a66c2]/10 transition-all"
                  title={`${founder.name} on LinkedIn`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function JobsSection({ company }: { company: Company }) {
  const jb = company.job_board;

  return (
    <Section title="Jobs">
      <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
        {jb ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {jb.count !== null ? (
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-[#fafafa]">
                    {jb.count}
                  </span>
                  <span className="text-sm text-[#71717a]">
                    open role{jb.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-[#71717a]">
                  Job count not available
                </span>
              )}

              <div className="flex flex-col gap-1">
                <JobSourceBadge jobBoard={jb} />
                {jb.ats_platform && (
                  <span className="text-[11px] text-[#52525b]">
                    via{" "}
                    <span className="capitalize font-medium text-[#71717a]">
                      {jb.ats_platform}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {jb.url && (
              <a
                href={jb.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  bg-[#f97316] text-white hover:bg-[#ea580c] shadow-lg shadow-orange-500/20
                  transition-all duration-200 hover:shadow-orange-500/30"
                id="view-jobs-link"
              >
                View all jobs
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#52525b]">
            No job board data available for this company.
          </p>
        )}
      </div>
    </Section>
  );
}

function DetailsSection({ company }: { company: Company }) {
  return (
    <Section title="Details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {company.industries.length > 0 && (
          <DetailCard label="Industries">
            <div className="flex flex-wrap gap-1.5">
              {company.industries.map((ind) => (
                <span
                  key={ind}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]/50"
                >
                  {ind}
                </span>
              ))}
            </div>
          </DetailCard>
        )}

        {company.tags.length > 0 && (
          <DetailCard label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {company.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#27272a] text-[#71717a] border border-[#3f3f46]/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </DetailCard>
        )}

        {company.regions.length > 0 && (
          <DetailCard label="Regions">
            <p className="text-sm text-[#a1a1aa]">
              {company.regions.join(", ")}
            </p>
          </DetailCard>
        )}

        {company.team_size && (
          <DetailCard label="Team Size">
            <p className="text-sm text-[#a1a1aa]">
              {company.team_size.toLocaleString()} people
            </p>
          </DetailCard>
        )}

        <DetailCard label="Source">
          <p className="text-sm text-[#a1a1aa]">{company.source_vc}</p>
        </DetailCard>

        <DetailCard label="Last Updated">
          <p className="text-sm text-[#a1a1aa]">
            {new Date(company.last_scraped).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </DetailCard>
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-[#71717a] uppercase tracking-wider mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DetailCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl">
      <p className="text-[11px] text-[#52525b] uppercase tracking-wider font-medium mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
