<script>
	import Map from '$lib/components/Map/Map.svelte';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
</script>

<div class="-mt-10">
	<div class="h-screen">
		<Map />
	</div>
</div>

<div class="p-4">
	<h2 class="text-xl font-bold">Current Map Style</h2>
	<p>
		Active style: <span class="font-medium">{$selectedMapStyle.name}</span>
	</p>
	<p class="text-sm">{$selectedMapStyle.description}</p>
</div>
