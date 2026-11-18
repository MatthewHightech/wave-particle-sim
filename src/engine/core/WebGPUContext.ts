export class WebGPUContext {
  public readonly device: GPUDevice;
  public readonly context: GPUCanvasContext;
  public readonly format: GPUTextureFormat;

  private constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat
  ) {
    this.device = device;
    this.context = context;
    this.format = format;
  }

  public static async create(
    canvas: HTMLCanvasElement,
    onDeviceLost?: (reason: string) => void
  ): Promise<WebGPUContext> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error('No appropriate GPUAdapter found.');
    }

    const device = await adapter.requestDevice();

    device.lost.then((info) => {
      if (info.reason !== 'destroyed') {
        onDeviceLost?.(info.message || 'GPU device was lost.');
      }
    });

    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Could not initialize WebGPU canvas context.');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    });

    return new WebGPUContext(device, context, format);
  }

  public destroy(): void {
    this.device.destroy();
  }
}
