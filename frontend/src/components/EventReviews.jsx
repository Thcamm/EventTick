/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import { Star, MessageSquare, Reply, AlertCircle, CheckCircle2, Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { PATHS } from '../routes/paths';

export default function EventReviews({ eventId }) {
  const [reviews, setReviews] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();
  const { user } = useAuth();

  const fetchReviews = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const res = await api.get(`/events/${eventId}/reviews`);
      setReviews(res.reviews || []);
      setTotalReviews(res.totalReviews || 0);
      setAverageRating(res.averageRating || 0);
    } catch {
      // Non-blocking for reviews
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [eventId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để gửi đánh giá');
      return;
    }
    if (!comment.trim()) {
      showToast('Vui lòng nhập nội dung đánh giá của bạn');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/events/${eventId}/reviews`, {
        rating: Number(rating),
        comment: comment.trim(),
      });
      showToast('Đã gửi đánh giá thành công! Cảm ơn bạn.');
      setComment('');
      fetchReviews();
    } catch (err) {
      showToast(err.message || 'Không thể gửi đánh giá. Bạn cần sở hữu vé hợp lệ của sự kiện để đánh giá.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 space-y-8 mt-10'>
      {/* Resale Notice Banner */}
      <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div className='flex items-center gap-2.5'>
          <Tag size={18} className='text-[#09090b]' />
          <span className='text-xs font-semibold text-[#09090b]'>
            Sự kiện đã hết vé chính thức? Tìm vé sang nhượng giá gốc tại Chợ Resale.
          </span>
        </div>
        <Link
          to={`/resale/${eventId}`}
          className='inline-flex items-center gap-1.5 px-4 py-2 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] shrink-0 transition-colors'>
          <span>Xem vé bán lại</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Header & Score summary */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f4f4f6] pb-6'>
        <div>
          <h2 className='text-xl font-bold text-[#09090b] flex items-center gap-2'>
            <MessageSquare size={20} />
            <span>Đánh giá từ khán giả</span>
          </h2>
          <p className='text-xs text-[#71717a] mt-1'>
            Ý kiến phản hồi từ những người mua vé thực tế tham gia sự kiện.
          </p>
        </div>

        <div className='flex items-center gap-3 bg-[#f9f9fb] border border-[#e4e4e7] px-4 py-2.5 rounded-full'>
          <div className='text-3xl font-extrabold text-[#09090b] leading-none'>
            {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
          </div>
          <div>
            <div className='flex items-center text-[#09090b]'>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  className={s <= Math.round(averageRating || 5) ? 'fill-[#09090b]' : 'text-[#e4e4e7]'}
                />
              ))}
            </div>
            <div className='text-[11px] text-[#71717a] mt-0.5'>{totalReviews} lượt đánh giá</div>
          </div>
        </div>
      </div>

      {/* Create Review Form */}
      <form onSubmit={handleSubmitReview} className='p-5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl space-y-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
          <span className='text-xs font-bold text-[#09090b]'>Để lại cảm nhận của bạn về sự kiện:</span>
          {/* Star selector */}
          <div className='flex items-center gap-1.5'>
            <span className='text-xs text-[#71717a] mr-1'>Chất lượng:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type='button'
                onClick={() => setRating(s)}
                className='text-[#09090b] hover:scale-115 transition-transform p-0.5'>
                <Star size={18} className={s <= rating ? 'fill-[#09090b]' : 'text-[#e4e4e7]'} />
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder='Chia sẻ trải nghiệm sân khấu, âm thanh, check-in hoặc nghệ sĩ...'
          className='w-full p-3.5 bg-white border border-[#e4e4e7] rounded-xl text-xs text-[#09090b] outline-none focus:border-[#09090b] resize-none transition-all'
        />

        <div className='flex justify-between items-center text-xs'>
          <span className='text-[11px] text-[#71717a]'>* Đánh giá chỉ dành cho khán giả đã sở hữu vé sự kiện</span>
          <button
            type='submit'
            disabled={submitting || !comment.trim()}
            className='px-5 py-2 bg-[#09090b] text-white font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
            {submitting ? 'Đang gửi...' : 'Gửi nhận xét'}
          </button>
        </div>
      </form>

      {/* Reviews List */}
      <div className='space-y-4'>
        {loading ? (
          <div className='py-6 text-center text-xs text-[#71717a]'>Đang tải đánh giá...</div>
        ) : reviews.length === 0 ? (
          <div className='py-8 text-center text-xs text-[#71717a]'>
            Chưa có đánh giá nào cho sự kiện này. Hãy là người đầu tiên chia sẻ cảm nhận!
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r._id} className='p-4.5 border border-[#e4e4e7] rounded-2xl space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-full bg-[#f4f4f6] text-[#09090b] font-bold text-xs flex items-center justify-center border border-[#e4e4e7]'>
                    {r.user?.name ? r.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className='text-xs font-bold text-[#09090b]'>{r.user?.name}</div>
                    <div className='text-[10px] text-[#71717a]'>
                      {r.createdAt && new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>

                <div className='flex text-[#09090b]'>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={12} className={s <= r.rating ? 'fill-[#09090b]' : 'text-[#e4e4e7]'} />
                  ))}
                </div>
              </div>

              <p className='text-xs text-[#52525b] leading-relaxed'>{r.comment}</p>

              {/* Organizer Reply */}
              {r.organizerReply && (
                <div className='ml-4 pl-3 border-l-2 border-[#09090b] bg-[#f9f9fb] p-3 rounded-r-xl space-y-1 text-xs'>
                  <div className='flex items-center gap-1.5 font-bold text-[#09090b] text-[11px]'>
                    <Reply size={12} />
                    <span>Phản hồi từ Ban Tổ Chức:</span>
                  </div>
                  <p className='text-[#52525b]'>{r.organizerReply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
