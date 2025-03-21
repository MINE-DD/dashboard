<script>
	import Map from '$lib/components/Map/Map.svelte';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
</script>

<!-- Fix the height to ensure map is properly sized -->
<div class="relative h-[80vh] w-full border-4 border-blue-500">
	<div class="h-full w-full">
		<Map />
	</div>
</div>
