// rich fills {name} placeholders of a message with React elements (a link, a
// highlighted word), so each language keeps its own word order around them.
import { Fragment } from "react";
import type { ReactNode } from "react";
import type { MessageKey } from ".";

const MARK = "\u0001";

/** rich(t, "browse.beFirst", { link: <Link …/> }) */
export function rich(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  key: MessageKey,
  nodes: Record<string, ReactNode>,
  params: Record<string, string | number> = {}
): ReactNode {
  const marks: Record<string, string> = {};
  for (const name of Object.keys(nodes)) marks[name] = `${MARK}${name}${MARK}`;
  // Splitting on the marks leaves the placeholder names at the odd indexes.
  return t(key, { ...params, ...marks })
    .split(MARK)
    .map((part, i) => <Fragment key={i}>{i % 2 === 1 ? nodes[part] ?? part : part}</Fragment>);
}
