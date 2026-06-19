import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentPage } from "./AgentPage";

interface RouteParams {
  slug: string;
}

export function generateStaticParams(): RouteParams[] {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) {
    return { title: "Agent not found" };
  }
  return {
    title: `${agent.name} — ${agent.title}`,
    description: `${agent.pitch} Chat directly with ${agent.name} on Vexor Terminal — wallet-gated on Solana.`,
  };
}

export default async function AgentSlugPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) {
    notFound();
  }
  return <AgentPage agent={agent} />;
}
