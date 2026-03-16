import Link from "next/link";

export interface ConnectMakeButtonProps {
  className?: string;
}

/**
 * Simple button component that starts the Make OAuth flow.
 */
export function ConnectMakeButton({ className }: ConnectMakeButtonProps) {
  return (
    <Link
      href="/api/oauth/make/connect"
      className={className ?? "inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"}
    >
      Connect Make
    </Link>
  );
}

export default ConnectMakeButton;

