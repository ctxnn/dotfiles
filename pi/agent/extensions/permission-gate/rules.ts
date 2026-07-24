export interface PermissionFinding {
  id: string;
  description: string;
}

interface PermissionRule extends PermissionFinding {
  pattern: RegExp;
}

const RULES: PermissionRule[] = [
  {
    id: "recursive-or-forced-remove",
    description: "recursive or forced file removal",
    pattern: /\brm\b[^\n;&|]*(?:-[a-z]*[rRf][a-z]*|--recursive|--force)(?=\s|=|$)/i,
  },
  {
    id: "privilege-escalation",
    description: "privilege escalation with sudo",
    pattern: /(?:^|[;&|()\n]\s*)sudo\b/i,
  },
  {
    id: "find-delete",
    description: "recursive deletion through find",
    pattern: /\bfind\b[^\n;&|]*\s-delete\b/i,
  },
  {
    id: "irreversible-file-command",
    description: "irreversible file destruction",
    pattern: /(?:^|[;&|()\n]\s*)(?:shred|unlink)\b/i,
  },
  {
    id: "scripted-recursive-delete",
    description: "recursive deletion through a scripting runtime",
    pattern: /\b(?:shutil\.rmtree|fs\.rmSync|fs\.rm|remove-item\b[^\n;&|]*-(?:recurse|force))\b/i,
  },
  {
    id: "destructive-git-reset-clean",
    description: "destructive Git reset or clean",
    pattern: /\bgit\s+(?:-[^\s]+\s+)*(?:reset\s+--hard|clean\b[^\n;&|]*(?:-[a-z]*f[a-z]*|--force))/i,
  },
  {
    id: "git-working-tree-discard",
    description: "discarding Git working-tree changes",
    pattern: /\bgit\s+(?:-[^\s]+\s+)*(?:restore\b|checkout\s+--\s+)/i,
  },
  {
    id: "git-history-rewrite",
    description: "Git history rewrite or forced push",
    pattern: /\bgit\s+(?:-[^\s]+\s+)*(?:push\b[^\n;&|]*(?:--force(?:-with-lease)?|-f\b|--delete\b)|commit\b[^\n;&|]*--amend\b|filter-branch\b|filter-repo\b|reflog\s+expire\b)/i,
  },
  {
    id: "git-destructive-delete",
    description: "destructive Git branch, tag, stash, or tracked-file deletion",
    pattern: /\bgit\s+(?:-[^\s]+\s+)*(?:branch\s+-D\b|tag\s+-d\b|stash\s+(?:drop|clear)\b|rm\b)/i,
  },
  {
    id: "filesystem-or-disk-operation",
    description: "filesystem, partition, or raw-disk modification",
    pattern: /\b(?:mkfs(?:\.[a-z0-9]+)?|fdisk|parted)\b|\bdiskutil\s+(?:erase|partition|apfs\s+delete)\b|\bdd\b[^\n;&|]*\bof=\/dev\/|>\s*\/dev\/(?:sd[a-z]|disk\d+)/i,
  },
  {
    id: "broad-permission-change",
    description: "recursive or world-writable permission/ownership change",
    pattern: /\b(?:chmod|chown)\b[^\n;&|]*(?:\s-R\b|\s--recursive\b|\s777\b)/i,
  },
  {
    id: "process-or-system-stop",
    description: "forced process termination or system shutdown",
    pattern: /(?:^|[;&|()\n]\s*)(?:kill\s+-9\b|killall\b|pkill\b|shutdown\b|reboot\b|halt\b|poweroff\b)/i,
  },
  {
    id: "destructive-database-operation",
    description: "destructive SQL operation",
    pattern: /\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+(?:TABLE\s+)?|DELETE\s+FROM)\b/i,
  },
  {
    id: "destructive-infrastructure-operation",
    description: "destructive container, cluster, or infrastructure operation",
    pattern: /\bterraform\s+destroy\b|\bkubectl\s+delete\b|\bdocker\s+(?:system\s+prune|volume\s+(?:rm|prune)|rm\b)/i,
  },
  {
    id: "destructive-cloud-operation",
    description: "potentially destructive cloud-resource deletion",
    pattern: /\b(?:aws|gcloud|az)\b[^\n;&|]*\b(?:delete|destroy|remove)\b/i,
  },
  {
    id: "delete-sync",
    description: "synchronization that deletes destination files",
    pattern: /\brsync\b[^\n;&|]*--delete(?:-before|-during|-delay|-after|-excluded)?\b/i,
  },
];

export function assessDangerousCommand(command: string): PermissionFinding[] {
  const normalized = command.replace(/\\\r?\n/g, " ").trim();
  return RULES.filter((rule) => rule.pattern.test(normalized)).map(({ id, description }) => ({ id, description }));
}

export const guardedOperationCount = RULES.length;
