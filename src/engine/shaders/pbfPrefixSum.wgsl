@group(0) @binding(0) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read_write> cellStarts: array<u32>;

var<workgroup> chunkTotals: array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3u) {
  let tid = lid.x;
  let itemsPerThread = (NUM_HASH_CELLS + 255u) / 256u;
  let start = tid * itemsPerThread;
  let end = min(start + itemsPerThread, NUM_HASH_CELLS);

  var total = 0u;
  for (var i = start; i < end; i++) {
    total += atomicLoad(&cellCounts[i]);
  }
  chunkTotals[tid] = total;

  for (var stride = 1u; stride < 256u; stride <<= 1u) {
    workgroupBarrier();
    var value = chunkTotals[tid];
    if (tid >= stride) {
      value += chunkTotals[tid - stride];
    }
    workgroupBarrier();
    chunkTotals[tid] = value;
  }

  workgroupBarrier();
  let grandTotal = chunkTotals[255u];
  var running = select(0u, chunkTotals[tid - 1u], tid > 0u);

  for (var i = start; i < end; i++) {
    let count = atomicLoad(&cellCounts[i]);
    cellStarts[i] = running;
    running += count;
    atomicStore(&cellCounts[i], 0u);
  }

  if (tid == 0u) {
    cellStarts[NUM_HASH_CELLS] = grandTotal;
  }
}
