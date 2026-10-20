<script lang="ts">
	let { onformat }: { onformat: (mark: string) => void } = $props();
</script>

<div class="tools" role="group" aria-label="Разметка текста">
	<button
		type="button"
		class="tools__item"
		title="Жирный (Ctrl+B)"
		aria-label="Жирный"
		onclick={() => onformat('**')}
	>
		<strong>Ж</strong>
	</button>

	<button
		type="button"
		class="tools__item"
		title="Курсив (Ctrl+I)"
		aria-label="Курсив"
		onclick={() => onformat('*')}
	>
		<span class="tools__italic">К</span>
	</button>

	<button
		type="button"
		class="tools__item"
		title="Моноширинный текст"
		aria-label="Моноширинный текст"
		onclick={() => onformat('`')}
	>
		<span class="tools__code">&lt;/&gt;</span>
	</button>

	<button
		type="button"
		class="tools__item"
		title="Спойлер"
		aria-label="Спойлер"
		onclick={() => onformat('||')}
	>
		<span class="tools__spoiler">С</span>
	</button>
</div>

<style>
	.tools {
		display: flex;
		gap: 0.25rem;
	}

	.tools__item {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		min-height: 2.25rem;
		padding-inline: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--muted);
		font-size: 0.8125rem;
		line-height: 1;
	}

	.tools__item:hover {
		background: var(--surface);
		color: var(--fg);
	}

	.tools__italic {
		font-style: italic;
	}

	.tools__code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75rem;
	}

	.tools__spoiler {
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}
</style>
