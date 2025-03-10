<script>
	import { fade } from 'svelte/transition';

	const gallery_items = [
		{
			url: 'https://picsum.photos/id/237/400/300',
			description: 'Dog'
		},
		{
			url: 'https://picsum.photos/id/238/400/300',
			description: 'Building'
		},
		{
			url: 'https://picsum.photos/id/240/400/300',
			description: 'Staircase'
		}
	];

	let currentSlideItem = $state(0);

	const nextImage = () => {
		currentSlideItem = (currentSlideItem + 1) % gallery_items.length;
	};

	const prevImage = () => {
		if (currentSlideItem != 0) {
			currentSlideItem = (currentSlideItem - 1) % gallery_items.length;
		} else {
			currentSlideItem = gallery_items.length - 1;
		}
	};
</script>

<div>
	<h3 class="mt-3 text-xl">Image Carousel</h3>
	{#each [gallery_items[currentSlideItem]] as item (currentSlideItem)}
		<img
			class="cursor-pointer"
			in:fade
			src={item.url}
			alt={item.description}
			width="100%"
			height="100%"
			onclick={() => nextImage()}
		/>
	{/each}
	<div class="carousel-buttons flex gap-1">
		<button onclick={() => prevImage()}>◀</button>
		{#each gallery_items as item, i (i)}
			<img
				class="cursor-pointer {currentSlideItem === i && 'border-primary border ring-offset-0 '}"
				onclick={() => (currentSlideItem = i)}
				src={item.url}
				axlt={item.description}
				width={50}
				height={50}
			/>
		{/each}
		<button onclick={() => nextImage()}>▶</button>
	</div>
</div>
