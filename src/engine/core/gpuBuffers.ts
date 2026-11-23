export function createGpuBuffer(
  device: GPUDevice,
  label: string,
  size: number,
  usage: GPUBufferUsageFlags,
  data?: ArrayBufferView<ArrayBufferLike> | ArrayBuffer
): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: Math.max(size, 4),
    usage,
  });
  if (data) {
    device.queue.writeBuffer(buffer, 0, data as GPUAllowSharedBufferSource);
  }
  return buffer;
}

export function createSimpleRenderPass(
  device: GPUDevice,
  label: string,
  format: GPUTextureFormat,
  shaderCode: string,
  uniformSize: number
): {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
} {
  const uniformBuffer = createGpuBuffer(
    device,
    `${label} Uniform Buffer`,
    uniformSize,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );

  const shaderModule = device.createShaderModule({
    label: `${label} Shader`,
    code: shaderCode,
  });

  const pipeline = device.createRenderPipeline({
    label: `${label} Pipeline`,
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const bindGroup = device.createBindGroup({
    label: `${label} BindGroup`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return { pipeline, uniformBuffer, bindGroup };
}
