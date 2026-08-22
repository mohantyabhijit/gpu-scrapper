import type { AnchorHTMLAttributes } from "react";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

export default function AppLink({ href, children, ...props }: AppLinkProps) {
  const resolvedHref = href.startsWith("/") ? `/scrapper${href}` : href;
  return <a href={resolvedHref} {...props}>{children}</a>;
}
