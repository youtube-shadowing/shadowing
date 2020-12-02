__author__ = 'Pavel Ulyashev'

import os
import glob
from flask import Flask, render_template, request, jsonify


app = Flask(__name__)



@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


@app.route('/', methods=['GET'])
def index_page():
    return render_template('app.html')


@app.route('/load/', methods=['POST'])
def load_video():
    youtube_link = request.form.get('youtube_link')
    return render_template('predict.html', predict=predictor.predict(text))


# @app.route('/predict-proba/', methods=['POST'])
# def predict_text_sentiment_proba():
#     text = request.form.get('text')
#     return render_template('predict_proba.html', predict=predictor.predict_proba(text))

def get_files_to_watch(*patterns):
    dirname = os.path.dirname(__file__)
    return [
        os.path.join(dirname, path)
        for pattern in patterns
        for path in glob.glob(pattern, recursive=True)
    ]


if __name__ == "__main__":
    app.run(
        host='0.0.0.0', 
        port=8800, 
        debug=False,
        extra_files=get_files_to_watch('templates/**/*.html', 'static/**/*')
    )
