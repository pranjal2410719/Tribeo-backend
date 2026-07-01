import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../shared/errors/app-error';
import { supabaseAdmin } from '../../config/supabase';

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    const parts = request.parts();
    let fileField: any = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        fileField = part;
        break;
      }
    }

    if (!fileField) {
      throw new AppError(400, 'No file provided');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of fileField.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const filename = `${request.user!.id}/${Date.now()}-${fileField.filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(filename, buffer, { contentType: fileField.mimetype });

    if (error) throw new AppError(500, 'Failed to upload file');

    const { data: urlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(data.path);

    return reply.status(201).send({ url: urlData.publicUrl, path: data.path });
  });
}
