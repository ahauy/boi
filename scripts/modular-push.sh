#!/usr/bin/env bash
# scripts/modular-push.sh
# Token-efficient automated modular commit and push utility for PalmSight

set -e

TARGET_BRANCH="${1:-}"
TOPIC="${2:-}"
DRY_RUN=false

for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
  fi
done

CURRENT_BRANCH=$(git branch --show-current)

# 1. Main branch protection check
if [ "$CURRENT_BRANCH" = "main" ]; then
  if [ -z "$TARGET_BRANCH" ] || [ "$TARGET_BRANCH" = "--dry-run" ]; then
    echo "❌ Error: Direct push to 'main' is restricted."
    echo "👉 Usage: bash scripts/modular-push.sh <target-branch-name> [topic-summary]"
    exit 1
  fi
  echo "🔀 Creating and switching to feature branch '$TARGET_BRANCH'..."
  if [ "$DRY_RUN" = false ]; then
    git checkout -b "$TARGET_BRANCH"
  fi
  CURRENT_BRANCH="$TARGET_BRANCH"
fi

# 2. Check for working tree changes
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  echo "✅ Working tree clean. Nothing to commit."
  exit 0
fi

# 3. Categorize files into layers
LAYER1_SPEC=()
LAYER2_SHARED=()
LAYER3_BACKEND=()
LAYER4_FRONTEND=()
LAYER5_DOCS=()
LAYER6_CHORE=()

while IFS= read -r line; do
  [ -z "$line" ] && continue
  FILE=$(echo "$line" | awk '{print $2}')
  # Handle renames where format is R  old -> new
  if [ $(echo "$line" | awk '{print $1}') = "R" ] || [ $(echo "$line" | awk '{print $1}') = "RM" ]; then
    FILE=$(echo "$line" | awk '{print $4}')
  fi

  case "$FILE" in
    .specify/*|specs/*)
      LAYER1_SPEC+=("$FILE")
      ;;
    shared/*|packages/shared-types/*)
      LAYER2_SHARED+=("$FILE")
      ;;
    backend/*|apps/api/*|prisma/*)
      LAYER3_BACKEND+=("$FILE")
      ;;
    frontend/*|apps/web/*)
      LAYER4_FRONTEND+=("$FILE")
      ;;
    docs/*|README.md|CHANGELOG.md)
      LAYER5_DOCS+=("$FILE")
      ;;
    *)
      LAYER6_CHORE+=("$FILE")
      ;;
  esac
done <<< "$CHANGES"

TOPIC_SLUG="${TOPIC:-feature changes}"
COMMITS_CREATED=()

# Helper to stage and commit
commit_layer() {
  local LAYER_NAME="$1"
  local COMMIT_MSG="$2"
  shift 2
  local FILES=("$@")

  if [ ${#FILES[@]} -gt 0 ]; then
    echo "📦 Staging ${LAYER_NAME} (${#FILES[@]} files)..."
    if [ "$DRY_RUN" = true ]; then
      echo "   [DRY-RUN] git add ${FILES[*]}"
      echo "   [DRY-RUN] git commit -m \"$COMMIT_MSG\""
      COMMITS_CREATED+=("dry-run | $COMMIT_MSG")
    else
      git add "${FILES[@]}"
      git commit -m "$COMMIT_MSG"
      HASH=$(git rev-parse --short HEAD)
      COMMITS_CREATED+=("$HASH | $COMMIT_MSG")
    fi
  fi
}

# 4. Commit each layer sequentially
commit_layer "Specs & Requirements" "docs(spec): add specification for ${TOPIC_SLUG}" "${LAYER1_SPEC[@]}"
commit_layer "Shared Contracts" "feat(shared): update types and contracts for ${TOPIC_SLUG}" "${LAYER2_SHARED[@]}"
commit_layer "Backend Services" "feat(backend): implement services and tests for ${TOPIC_SLUG}" "${LAYER3_BACKEND[@]}"
commit_layer "Frontend UI" "feat(frontend): implement UI components and views for ${TOPIC_SLUG}" "${LAYER4_FRONTEND[@]}"
commit_layer "Documentation" "docs: update feature documentation and roadmap for ${TOPIC_SLUG}" "${LAYER5_DOCS[@]}"
commit_layer "Chores & Configs" "chore: update configs, dependencies, and tooling" "${LAYER6_CHORE[@]}"

# 5. Push to remote
echo "🚀 Pushing branch '$CURRENT_BRANCH' to remote origin..."
if [ "$DRY_RUN" = true ]; then
  echo "   [DRY-RUN] git push -u origin $CURRENT_BRANCH"
else
  git push -u origin "$CURRENT_BRANCH"
fi

# 6. Print clean summary table & PR template
echo ""
echo "=================================================="
echo "🎉 Modular Commit & Push Completed Successfully!"
echo "Branch: $CURRENT_BRANCH"
echo "=================================================="
echo ""
echo "### Commits Created:"
for c in "${COMMITS_CREATED[@]}"; do
  echo "- $c"
done
echo ""
echo "👉 Create Pull Request: https://github.com/DucDMinh/PalmSight/pull/new/$CURRENT_BRANCH"
