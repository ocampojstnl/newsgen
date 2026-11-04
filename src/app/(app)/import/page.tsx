import path from "node:path";
import { ImportArticle } from "@/components/import-article";

export default function ImportPage() {
  return <ImportArticle extensionFolder={path.join(process.cwd(), "extension")} />;
}
