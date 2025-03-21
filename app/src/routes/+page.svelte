<script>
	import Map from '$lib/components/Map/Map.svelte';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
</script>

<!-- Fix the height to ensure map is properly sized -->
<div class="relative h-full w-full">
	<Map />
</div>
